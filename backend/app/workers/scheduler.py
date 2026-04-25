"""Capacity-aware enqueue helper for WorldFork workers.

Public API
----------
make_envelope(...)    -- build a JobEnvelope with sane defaults.
enqueue(envelope)     -- send the envelope onto its Celery queue.
already_running(key)  -- Redis SETNX idempotency guard.
mark_done(key, ...)   -- persist a completion marker for a key.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from backend.app.schemas.jobs import JobEnvelope, JobType
from backend.app.workers.queues import Queues, queue_for_job

if TYPE_CHECKING:
    pass

# ---------------------------------------------------------------------------
# Envelope builder
# ---------------------------------------------------------------------------

def make_envelope(
    *,
    job_type: JobType,
    run_id: str,
    payload: dict,
    universe_id: str | None = None,
    tick: int | None = None,
    idempotency_key: str | None = None,
    attempt_number: int = 1,
    priority_override: Queues | None = None,
) -> JobEnvelope:
    """Build a :class:`JobEnvelope` ready to be handed to :func:`enqueue`.

    The ``idempotency_key`` defaults to a deterministic string derived from
    the job_type, run_id, universe_id, and tick so that retries reuse the
    same key.  Callers may supply their own key for finer control.
    """
    import uuid

    job_id = str(uuid.uuid4())

    if idempotency_key is None:
        parts = [job_type, run_id]
        if universe_id:
            parts.append(universe_id)
        if tick is not None:
            parts.append(f"t{tick}")
        idempotency_key = ":".join(parts)

    # Resolve queue → priority
    queue = priority_override or queue_for_job(job_type)
    priority = queue.value  # queue name == priority string in our schema

    return JobEnvelope(
        job_id=job_id,
        job_type=job_type,
        priority=priority,  # type: ignore[arg-type]
        run_id=run_id,
        universe_id=universe_id,
        tick=tick,
        attempt_number=attempt_number,
        idempotency_key=idempotency_key,
        payload=payload,
        created_at=datetime.now(tz=UTC),
    )


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------

async def enqueue(
    envelope: JobEnvelope,
    *,
    eta: datetime | None = None,
    countdown: float | None = None,
) -> str:
    """Enqueue an envelope onto its routed Celery queue.

    Returns the Celery task id (same as ``envelope.job_id``).
    """
    # Deferred import to avoid circular dependency at module load time.
    from backend.app.workers.celery_app import celery_app

    task_name = envelope.job_type
    q = queue_for_job(envelope.job_type).value

    async_result = celery_app.send_task(
        task_name,
        args=[envelope.model_dump_json()],
        queue=q,
        task_id=envelope.job_id,
        eta=eta,
        countdown=countdown,
        headers={"idempotency_key": envelope.idempotency_key},
    )
    return async_result.id


# ---------------------------------------------------------------------------
# Idempotency helpers (async Redis)
# ---------------------------------------------------------------------------

async def already_running(idempotency_key: str) -> bool:
    """Redis SETNX guard — returns True if a worker has already claimed this key.

    The key expires after 24 h so stale locks don't block reruns indefinitely.
    """
    from backend.app.core.redis_client import get_redis_client

    redis = get_redis_client()
    claimed = await redis.set(
        f"idem:{idempotency_key}", "1", nx=True, ex=86400
    )
    # set() returns True when the key was newly set; None when it already existed.
    return claimed is None


async def mark_done(
    idempotency_key: str,
    result_path: str | None = None,
) -> None:
    """Persist a completion marker so subsequent attempts can short-circuit.

    Stores the result_path (or empty string) under ``done:<key>``.
    The entry expires after 24 h alongside the SETNX lock.
    """
    from backend.app.core.redis_client import get_redis_client

    redis = get_redis_client()
    value = result_path or ""
    await redis.set(f"done:{idempotency_key}", value, ex=86400)


async def get_done_result(idempotency_key: str) -> str | None:
    """Return the cached result_path for a completed job, or None."""
    from backend.app.core.redis_client import get_redis_client

    redis = get_redis_client()
    return await redis.get(f"done:{idempotency_key}")
