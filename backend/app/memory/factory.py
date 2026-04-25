"""
Memory provider factory — returns a cached MemoryProvider singleton.

Priority:
  1. If ZepConfig.enabled and ZEP_API_KEY is set: ZepMemoryProvider with LocalMemoryProvider fallback.
  2. Otherwise: LocalMemoryProvider.

Call reload_memory_provider() to invalidate the singleton (e.g. after settings change).
"""
from __future__ import annotations

import os

from backend.app.memory.base import MemoryProvider
from backend.app.memory.local import LocalMemoryProvider

_provider_singleton: MemoryProvider | None = None


def get_memory() -> MemoryProvider:
    """Return the cached memory provider singleton, creating it if needed."""
    global _provider_singleton
    if _provider_singleton is not None:
        return _provider_singleton
    _provider_singleton = _build_provider()
    return _provider_singleton


def _build_provider() -> MemoryProvider:
    """Construct the appropriate provider based on current settings."""
    from backend.app.core.config import settings

    if not settings.zep_enabled:
        return LocalMemoryProvider()

    api_key = settings.zep_api_key or os.environ.get("ZEP_API_KEY", "")

    if not api_key:
        return LocalMemoryProvider()

    # Attempt to load ZepConfig from the settings table.
    # If unavailable (no DB, no row), fall back to defaults.
    try:
        zep_cfg = _load_zep_config()
    except Exception:
        zep_cfg = None

    if zep_cfg is not None and not zep_cfg.enabled:
        return LocalMemoryProvider()

    mode = zep_cfg.mode if zep_cfg is not None else "cohort_memory"

    from backend.app.memory.zep_adapter import ZepMemoryProvider

    return ZepMemoryProvider(
        api_key=api_key,
        mode=mode,
        local_fallback=LocalMemoryProvider(),
    )


def _load_zep_config():
    """Try to load ZepConfig from the DB settings row.  Returns None on any error."""
    try:
        from backend.app.schemas.settings import ZepConfig

        # If there's a DB-backed settings loader available, use it.
        # For now we return a default ZepConfig so the factory works without a DB.
        return ZepConfig()
    except Exception:
        return None


async def reload_memory_provider() -> None:
    """Invalidate the singleton so the next call to get_memory() rebuilds it."""
    global _provider_singleton
    _provider_singleton = None
