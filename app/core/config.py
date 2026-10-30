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
    max_upload_bytes: int = 2 * 1024**3

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
