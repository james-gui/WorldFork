"""WorldFork FastAPI application factory."""
from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    try:
        from backend.app.providers import ensure_providers_in_loop

        await ensure_providers_in_loop(settings)
    except Exception:
        # Provider health is surfaced through /readyz and provider test endpoints.
        pass
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="WorldFork API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.next_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict:
        return {"ok": True}

    @app.get("/readyz", tags=["health"], response_model=None)
    async def readyz():
        """Readiness probe for core runtime dependencies."""
        checks: dict[str, dict] = {}

        try:
            from backend.app.core.db import engine

            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["database"] = {"ok": True}
        except Exception as exc:
            checks["database"] = {"ok": False, "error": str(exc)}

        try:
            from backend.app.core.redis_client import get_redis_client

            await get_redis_client().ping()
            checks["redis"] = {"ok": True}
        except Exception as exc:
            checks["redis"] = {"ok": False, "error": str(exc)}

        try:
            from backend.app.providers import get_provider

            provider = get_provider("openrouter")
            health = await asyncio.wait_for(provider.healthcheck(), timeout=5)
            payload = health.model_dump() if hasattr(health, "model_dump") else dict(health)
            checks["openrouter"] = {
                "ok": bool(payload.get("ok", False)),
                "configured": True,
                "model": payload.get("model"),
                "error": payload.get("error"),
            }
        except Exception as exc:
            checks["openrouter"] = {
                "ok": False,
                "configured": bool(settings.openrouter_api_key),
                "error": str(exc),
            }

        checks["zep"] = {"ok": True, "enabled": settings.zep_enabled}

        payload = {
            "ok": all(c.get("ok", False) for c in checks.values()),
            "environment": settings.environment,
            "default_model": settings.default_model,
            "checks": checks,
        }
        if not payload["ok"]:
            return JSONResponse(status_code=503, content=payload)
        return payload

    # Mount observability router (/metrics)
    from backend.app.observability.router import router as metrics_router
    app.include_router(metrics_router)

    # Mount integrations router (/api/integrations/...)
    from backend.app.api.integrations import router as integrations_router
    from backend.app.api.integrations import webhooks_router
    app.include_router(integrations_router)
    app.include_router(webhooks_router)

    # Mount WebSocket router (/ws/...)
    from backend.app.api.websockets import router as ws_router
    app.include_router(ws_router)

    # Mount B5-A routers — runs, universes, multiverse
    from backend.app.api.multiverse import router as multiverse_router
    from backend.app.api.runs import router as runs_router
    from backend.app.api.universes import router as universes_router
    app.include_router(runs_router)
    app.include_router(universes_router)
    app.include_router(multiverse_router)

    # Mount B5-B routers — settings, jobs, logs
    from backend.app.api.jobs import router as jobs_router
    from backend.app.api.logs import router as logs_router
    from backend.app.api.settings import router as settings_router
    app.include_router(settings_router)
    app.include_router(jobs_router)
    app.include_router(logs_router)

    return app


app = create_app()
