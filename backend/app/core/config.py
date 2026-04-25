"""Application settings loaded from environment variables / .env file."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM provider keys
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    zep_enabled: bool = Field(default=False, alias="ZEP_ENABLED")
    zep_api_key: str = Field(default="", alias="ZEP_API_KEY")

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://worldfork:worldfork@localhost:5433/worldfork",
        alias="DATABASE_URL",
    )
    database_url_sync: str = Field(
        default="postgresql+psycopg://worldfork:worldfork@localhost:5433/worldfork",
        alias="DATABASE_URL_SYNC",
    )

    # Redis / Celery
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(
        default="redis://localhost:6379/1", alias="CELERY_BROKER_URL"
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/2", alias="CELERY_RESULT_BACKEND"
    )

    # Run ledger
    run_root: Path = Field(default=Path("/data/runs"), alias="RUN_ROOT")

    # Provider defaults
    default_model: str = Field(default="deepseek/deepseek-v3.2", alias="DEFAULT_MODEL")
    fallback_model: str = Field(default="openai/gpt-4o-mini", alias="FALLBACK_MODEL")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL"
    )
    openrouter_http_referer: str = Field(
        default="http://localhost:3003", alias="OPENROUTER_HTTP_REFERER"
    )
    openrouter_title: str = Field(default="WorldFork", alias="OPENROUTER_TITLE")

    # CORS / Next.js
    next_origin: str = Field(default="http://localhost:3003", alias="NEXT_ORIGIN")
    next_public_api_url: str = Field(
        default="http://localhost:8003", alias="NEXT_PUBLIC_API_URL"
    )
    next_public_ws_url: str = Field(
        default="ws://localhost:8003", alias="NEXT_PUBLIC_WS_URL"
    )

    # Misc
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")


# Module-level singleton — import this everywhere
settings = Settings()
