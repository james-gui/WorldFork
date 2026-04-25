"""WorldFork workers package.

Public re-exports consumed by the rest of the codebase:
- ``celery_app``  — the configured Celery application instance.
- ``enqueue``     — async helper to dispatch a JobEnvelope to a queue.
- ``Queues``      — StrEnum of queue names (P0, P1, P2, P3, DEAD_LETTER).
"""
from __future__ import annotations

from backend.app.workers.celery_app import celery_app
from backend.app.workers.queues import Queues
from backend.app.workers.scheduler import enqueue

__all__ = ["celery_app", "enqueue", "Queues"]
