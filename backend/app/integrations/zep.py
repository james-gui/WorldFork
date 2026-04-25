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
        # Attempt to use the local memory provider as a health proxy
        # when the Zep adapter is not yet wired up (pre-B6-A state)
        from backend.app.memory.local import LocalMemoryProvider

        start = time.monotonic()
        provider = LocalMemoryProvider()
        health = await provider.healthcheck()
        latency_ms = int((time.monotonic() - start) * 1000)

        from backend.app.core.clock import now_utc

        return {
            "enabled": False,  # Zep SDK not wired yet — local fallback active
            "mode": "local",
            "degraded": not health.get("ok", True),
            "last_healthcheck_at": now_utc().isoformat(),
            "last_latency_ms": latency_ms,
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
