"""The ONLY module that knows Meta's URLs and JSON shapes. Everything else uses MetaClient, so an API-version
update means editing this file (and META_API_VERSION)."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings
from app.meta.errors import MetaError


@dataclass
class TokenInfo:
    access_token: str
    expires_at: datetime | None  # None = no fixed expiry reported


@dataclass
class TokenInspection:
    is_valid: bool
    scopes: list[str]
    expires_at: datetime | None
    user_id: str | None


@dataclass
class MetaPage:
    id: str
    name: str
    access_token: str
    tasks: list[str]

    @property
    def can_publish(self) -> bool:
        return "CREATE_CONTENT" in self.tasks


class MetaClient(ABC):
    configured: bool = True

    @abstractmethod
    def login_url(self, state: str, hint: str = "") -> str: ...
    @abstractmethod
    def exchange_code(self, code: str) -> TokenInfo: ...
    @abstractmethod
    def extend_token(self, short_token: str) -> TokenInfo: ...
    @abstractmethod
    def inspect_token(self, token: str) -> TokenInspection: ...
    @abstractmethod
    def me(self, token: str) -> dict: ...
    @abstractmethod
    def list_pages(self, user_token: str) -> list[MetaPage]: ...


class LiveMetaClient(MetaClient):
    def __init__(self, transport: httpx.BaseTransport | None = None, app_id: str | None = None, app_secret: str | None = None):
        s = get_settings()
        self.version, self.redirect_uri, self.scopes = s.meta_api_version, s.meta_redirect_uri, s.meta_scope_list
        self.app_id = s.meta_app_id if app_id is None else app_id
        self.app_secret = s.meta_app_secret if app_secret is None else app_secret
        self.configured = bool(self.app_id and self.app_secret)
        self.http = httpx.Client(base_url=f"https://graph.facebook.com/{self.version}", timeout=20, transport=transport)

    def _get(self, path: str, params: dict) -> dict:
        try:
            r = self.http.get(path, params=params)
        except httpx.HTTPError as e:
            raise MetaError("Network error talking to Meta", network=True) from e
        try:
            data = r.json()
        except ValueError:
            data = {}
        if r.status_code >= 400 or (isinstance(data, dict) and "error" in data):
            err = data.get("error") or {} if isinstance(data, dict) else {}
            raise MetaError(err.get("message") or f"HTTP {r.status_code}", code=err.get("code"), subcode=err.get("error_subcode"),
                            http_status=r.status_code, retry_after=r.headers.get("Retry-After"))
        return data

    @staticmethod
    def _expiry(data: dict) -> datetime | None:
        secs = data.get("expires_in")
        return datetime.now(timezone.utc) + timedelta(seconds=int(secs)) if secs else None

    def login_url(self, state: str, hint: str = "") -> str:
        q = urlencode({"client_id": self.app_id, "redirect_uri": self.redirect_uri, "state": state,
                       "response_type": "code", "scope": ",".join(self.scopes)})
        return f"https://www.facebook.com/{self.version}/dialog/oauth?{q}"

    def exchange_code(self, code: str) -> TokenInfo:
        d = self._get("/oauth/access_token", {"client_id": self.app_id, "redirect_uri": self.redirect_uri,
                                              "client_secret": self.app_secret, "code": code})
        return TokenInfo(d["access_token"], self._expiry(d))

    def extend_token(self, short_token: str) -> TokenInfo:
        d = self._get("/oauth/access_token", {"grant_type": "fb_exchange_token", "client_id": self.app_id,
                                              "client_secret": self.app_secret, "fb_exchange_token": short_token})
        return TokenInfo(d["access_token"], self._expiry(d))

    def inspect_token(self, token: str) -> TokenInspection:
        d = self._get("/debug_token", {"input_token": token, "access_token": f"{self.app_id}|{self.app_secret}"}).get("data", {})
        exp = d.get("expires_at")
        return TokenInspection(bool(d.get("is_valid")), list(d.get("scopes") or []),
                               datetime.fromtimestamp(exp, timezone.utc) if exp else None, d.get("user_id"))

    def me(self, token: str) -> dict:
        return self._get("/me", {"fields": "id,name", "access_token": token})

    def list_pages(self, user_token: str) -> list[MetaPage]:
        pages: list[MetaPage] = []
        params: dict = {"fields": "id,name,access_token,tasks", "limit": 100, "access_token": user_token}
        for _ in range(20):  # hard stop against runaway pagination
            d = self._get("/me/accounts", params)
            for p in d.get("data", []):
                if p.get("access_token"):
                    pages.append(MetaPage(str(p["id"]), p.get("name", ""), p["access_token"], list(p.get("tasks") or [])))
            after = (d.get("paging") or {}).get("cursors", {}).get("after")
            if not (d.get("paging") or {}).get("next") or not after:
                break
            params = {**params, "after": after}
        return pages


@dataclass
class MockMetaClient(MetaClient):
    """No network, no Facebook account. Mimics Meta closely enough for the whole flow and for tests."""
    granted_scopes: list[str] | None = None
    lost_page_ids: set[str] = field(default_factory=set)
    errors: dict[str, MetaError] = field(default_factory=dict)  # method name -> error to raise

    def _maybe_raise(self, name: str) -> None:
        if name in self.errors:
            raise self.errors[name]

    def login_url(self, state: str, hint: str = "") -> str:
        return f"{get_settings().meta_redirect_uri}?{urlencode({'code': f'mock-{hint}', 'state': state})}"

    def exchange_code(self, code: str) -> TokenInfo:
        self._maybe_raise("exchange_code")
        if not code.startswith("mock-"):
            raise MetaError("Invalid verification code", code=100, http_status=400)
        return TokenInfo(f"mocktoken-{code[5:]}", datetime.now(timezone.utc) + timedelta(days=1))

    def extend_token(self, short_token: str) -> TokenInfo:
        self._maybe_raise("extend_token")
        return TokenInfo(short_token, datetime.now(timezone.utc) + timedelta(days=60))

    def inspect_token(self, token: str) -> TokenInspection:
        self._maybe_raise("inspect_token")
        scopes = self.granted_scopes if self.granted_scopes is not None else get_settings().meta_scope_list
        return TokenInspection(True, scopes, datetime.now(timezone.utc) + timedelta(days=60), f"mockuser-{token[10:]}")

    def me(self, token: str) -> dict:
        self._maybe_raise("me")
        return {"id": f"mockuser-{token[10:]}", "name": "Mock User"}

    def list_pages(self, user_token: str) -> list[MetaPage]:
        self._maybe_raise("list_pages")
        n = user_token[10:]
        pages = [MetaPage(f"mock{n}-page-1", "Mock Page One", f"mockpagetoken-{n}-1", ["CREATE_CONTENT", "MANAGE", "MODERATE"]),
                 MetaPage(f"mock{n}-page-2", "Mock Page Two", f"mockpagetoken-{n}-2", ["CREATE_CONTENT", "ANALYZE"]),
                 MetaPage(f"mock{n}-page-3", "Mock Page Three (no publish rights)", f"mockpagetoken-{n}-3", ["ANALYZE"])]
        return [p for p in pages if p.id not in self.lost_page_ids]


@lru_cache
def get_meta_client() -> MetaClient:
    return LiveMetaClient() if get_settings().meta_mode == "live" else MockMetaClient()
