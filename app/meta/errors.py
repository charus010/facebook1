"""Meta Graph API error classification. Codes come from Meta's error reference; re-verify when changing API version."""

AUTH_CODES = {102, 190}  # token expired / revoked / invalid
RATE_CODES = {4, 17, 32, 613}  # app / user / page / custom rate limits
PERMISSION_CODES = {10, *range(200, 300)}
TRANSIENT_CODES = {1, 2}


class MetaError(Exception):
    def __init__(self, message: str, code: int | None = None, subcode: int | None = None,
                 http_status: int | None = None, retry_after: str | None = None, network: bool = False):
        super().__init__(message)
        self.code, self.subcode, self.http_status, self.retry_after, self.network = code, subcode, http_status, retry_after, network

    @property
    def kind(self) -> str:
        if self.code in AUTH_CODES:
            return "auth"
        if self.code in RATE_CODES or self.http_status == 429:
            return "rate_limit"
        if self.code in PERMISSION_CODES:
            return "permission"
        if self.network or self.code in TRANSIENT_CODES or (self.http_status or 0) >= 500:
            return "transient"
        return "other"
