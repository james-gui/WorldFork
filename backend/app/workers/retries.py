"""Retry decorator and error taxonomy for WorldFork Celery tasks.

Usage
-----
@celery_app.task(bind=True, name="my_task", max_retries=3)
@with_retries(max_retries=3, default_retry_delay=10)
def my_task(self, envelope_json: str) -> dict:
    ...

Notes
-----
- ``with_retries`` catches :exc:`SoftTimeLimitExceeded` and
  :exc:`RetryableError`, retries them transparently.
- Other exceptions are treated as permanent failures and re-raised.
- :func:`route_dead_letter` should be called from a task's ``on_failure``
  hook (or from the permanent-failure branch) to push the envelope onto
  the Redis dead-letter list for UI inspection.
"""
from __future__ import annotations

import functools
import logging

from celery.exceptions import SoftTimeLimitExceeded

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exception taxonomy
# ---------------------------------------------------------------------------

class RetryableError(Exception):
    """Raised inside a task to signal a transient failure — will be retried."""


class FatalError(Exception):
    """Raised inside a task to signal a permanent failure — goes to dead-letter."""


# ---------------------------------------------------------------------------
# Decorator factory
# ---------------------------------------------------------------------------

def with_retries(*, max_retries: int = 3, default_retry_delay: int = 10):
    """Decorator that adds structured retry semantics to a bound Celery task.

    Parameters
    ----------
    max_retries:
        Maximum number of automatic retries before the task is declared dead.
    default_retry_delay:
        Seconds to wait before the next retry attempt.
    """

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(self, *args, **kwargs):
            try:
                return fn(self, *args, **kwargs)
            except SoftTimeLimitExceeded:
                # Timed out but still within hard limit — retry quickly.
                logger.warning(
                    "task soft time limit exceeded, retrying",
                    extra={"task_name": self.name, "task_id": self.request.id},
                )
                raise self.retry(countdown=default_retry_delay)  # noqa: B904
            except RetryableError as exc:
                logger.warning(
                    "retryable error in task",
                    extra={
                        "task_name": self.name,
                        "task_id": self.request.id,
                        "error": str(exc),
                    },
                )
                raise self.retry(exc=exc, countdown=default_retry_delay)  # noqa: B904
            except FatalError:
                # Re-raise directly — no retry, goes to dead-letter via on_failure.
                logger.exception(
                    "fatal error in task — no retry",
                    extra={"task_name": self.name, "task_id": self.request.id},
                )
                raise
            except Exception:
                logger.exception(
                    "task failed permanently",
                    extra={"task_name": self.name, "task_id": self.request.id},
                )
                raise

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Dead-letter helper
# ---------------------------------------------------------------------------

def route_dead_letter(envelope_json: str, error: str) -> None:
    """Push a permanently-failed envelope onto the Redis dead-letter list.

    The list ``wf:dead_letter`` is consumed by the jobs API for UI display
    and by the dead-letter monitoring script.

    This function is intentionally synchronous so it can be called from
    Celery's ``on_failure`` hook without an event loop.
    """
    import json
    import time

    try:
        import redis as sync_redis

        from backend.app.core.config import settings

        client = sync_redis.from_url(settings.redis_url, decode_responses=True)
        entry = json.dumps(
            {
                "envelope_json": envelope_json,
                "error": error,
                "dead_at": time.time(),
            }
        )
        # LPUSH so the newest entry is at the head; cap the list at 10 000 entries.
        pipe = client.pipeline()
        pipe.lpush("wf:dead_letter", entry)
        pipe.ltrim("wf:dead_letter", 0, 9_999)
        pipe.execute()
    except Exception:
        # Dead-letter routing must never crash the caller.
        logger.exception("failed to push to dead-letter list")
