"""WorldFork FastAPI application factory."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    # TODO: wire up startup/shutdown hooks (DB pool, Redis, etc.) in later batches
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

    @app.get("/readyz", tags=["health"])
    async def readyz() -> dict:
        """Readiness probe — returns 200 if configuration is loaded."""
        return {
            "ok": True,
            "environment": settings.environment,
            "default_model": settings.default_model,
        }

    # Mount observability router (/metrics)
    from backend.app.observability.router import router as metrics_router
    app.include_router(metrics_router)

    # Mount integrations router (/api/integrations/...)
    from backend.app.api.integrations import router as integrations_router
    app.include_router(integrations_router)

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
