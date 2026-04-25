"""Celery Beat periodic-task schedule for WorldFork.

Import this module after celery_app is configured to register the schedule.
Beat workers run: ``celery -A backend.app.workers.celery_app beat --loglevel=info``
"""
from __future__ import annotations

from backend.app.workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    # Lightweight liveness probe — runs every 30 seconds to confirm workers
    # are alive.  The heartbeat task is defined in workers/jobs.py.
    "heartbeat": {
        "task": "worldfork.heartbeat",
        "schedule": 30.0,
    },
}
