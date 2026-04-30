from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DEBUG: bool = False
    DATABASE_URL: str
    CORS_ORIGINS: str = "http://localhost:5173"

    # JWT / auth
    JWT_SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Set to False to disable public user self-registration.
    # In production or when a parent app manages users, keep this False.
    REGISTRATION_OPEN: bool = True

    # When True the service trusts X-Forwarded-User and X-Forwarded-Role
    # headers injected by a parent application / reverse-proxy running in
    # front of this subsystem.  NEVER enable this without a trusted proxy
    # that strips these headers from untrusted clients.
    PROXY_AUTH_ENABLED: bool = False

    # Human-readable name returned by /api/v1/info so the parent app can
    # identify this subsystem without hard-coding strings.
    SUBSYSTEM_NAME: str = "survey-constructor"
    SUBSYSTEM_VERSION: str = "0.1.0"

    def cors_list(self) -> List[str]:
        return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]


settings = Settings()