from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "demo" = sample/testing behaviour; "production" = locked down. Publishing is NOT implemented in Phase 2 either way.
    app_mode: str = "demo"
    database_url: str = "sqlite:///./dev.db"
    secret_key: str
    encryption_key: str  # Fernet key, used to encrypt Meta tokens at rest (Phase 3)
    access_token_minutes: int = 30
    cors_origins: str = "http://localhost:3000"
    admin_email: str | None = None
    admin_password: str | None = None
    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "videos"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    # --- Meta (Phase 3). "mock" needs no Facebook credentials (tests/demo); "live" talks to Meta's Graph API.
    meta_mode: str = "mock"
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_redirect_uri: str = "http://localhost:8000/api/meta/callback"  # must match the app's Valid OAuth Redirect URIs exactly
    meta_api_version: str = "v25.0"  # Graph API version used in every URL; change it here only
    # Minimum scopes for connecting + listing + publishing posts. Add publish_video / read_insights when Phase 4 needs them
    # AND they appear in your app's use case.
    meta_scopes: str = "pages_show_list,pages_read_engagement,pages_manage_posts"
    frontend_url: str = "http://localhost:3000"  # where the browser returns after Facebook login
    max_upload_bytes: int = 2 * 1024**3  # videos
    max_image_bytes: int = 10 * 1024**2  # images; verify Meta's current photo limits before Phase 4

    @property
    def meta_scope_list(self) -> list[str]:
        return [s.strip() for s in self.meta_scopes.split(",") if s.strip()]

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
