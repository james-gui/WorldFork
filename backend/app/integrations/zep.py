"""Zep healthcheck/status summary for /metrics and the integrations API.

Exposes ``zep_status_summary()`` which returns a lightweight dict usable by
the Prometheus metrics layer and B5-B integrations endpoints.

If the ``memory.factory`` module is not yet available (earlier batch not run),
this module degrades gracefully and reports enabled=False.
"""
from __future__ import annotations

import time


async def zep_status_summary() -> dict:
    """Return a status summary for the Zep memory integration.

    Returns:
        Dict with keys:
            - ``enabled`` (bool): Whether Zep is configured.
            - ``mode`` (str): Active memory mode (``"zep"`` or ``"local"``).
            - ``degraded`` (bool): Whether the last healthcheck was degraded.
            - ``last_healthcheck_at`` (str | None): ISO timestamp of last check.
            - ``last_latency_ms`` (int | None): Last measured latency in ms.
    """
    try:
        from backend.app.core.config import settings
        from backend.app.core.clock import now_utc

        if not settings.zep_enabled or not settings.zep_api_key:
            return {
                "enabled": False,
                "mode": "local",
                "degraded": False,
                "last_healthcheck_at": now_utc().isoformat(),
                "last_latency_ms": 0,
            }

        from backend.app.memory.factory import get_memory

        start = time.monotonic()
        provider = get_memory()
        health = await provider.healthcheck()
        latency_ms = int((time.monotonic() - start) * 1000)
        health_payload = health.model_dump() if hasattr(health, "model_dump") else dict(health)
        is_zep = provider.__class__.__name__ == "ZepMemoryProvider"
        ok = bool(health_payload.get("ok", False))

        return {
            "enabled": bool(is_zep),
            "mode": "zep" if is_zep else "local",
            "degraded": bool(getattr(provider, "degraded", False)) or not ok,
            "last_healthcheck_at": now_utc().isoformat(),
            "last_latency_ms": latency_ms,
            "error": None if ok else str(health_payload.get("error", "healthcheck failed")),
        }
    except Exception as exc:
        return {
            "enabled": False,
            "mode": "unknown",
            "degraded": True,
            "last_healthcheck_at": None,
            "last_latency_ms": None,
            "error": str(exc),
        }
