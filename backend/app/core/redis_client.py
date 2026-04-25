"""Async Redis client singleton and FastAPI dependency."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from functools import lru_cache

import redis.asyncio as aioredis

from backend.app.core.config import settings


@lru_cache(maxsize=1)
def _get_redis_pool() -> aioredis.Redis:
    """Create a lazy Redis connection pool singleton."""
    return aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )


def get_redis_client() -> aioredis.Redis:
    """Return the shared async Redis client."""
    return _get_redis_pool()


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """FastAPI dependency that yields the Redis client."""
    yield get_redis_client()


def reset_redis_pool() -> None:
    """Drop the cached Redis client. Call when the active asyncio loop changes
    (e.g. between Celery task invocations) so the next get_redis_client() builds
    a fresh client bound to the current loop.
    """
    _get_redis_pool.cache_clear()
