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

from sqlalchemy.exc import IntegrityError

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
    await mark_enqueued(envelope)

    # Deferred import to avoid circular dependency at module load time.
    from backend.app.workers.celery_app import celery_app

    task_name = envelope.job_type
    allowed_queues = {q.value for q in Queues}
    q = envelope.priority if envelope.priority in allowed_queues else queue_for_job(envelope.job_type).value

    try:
        async_result = celery_app.send_task(
            task_name,
            args=[envelope.model_dump_json()],
            queue=q,
            task_id=envelope.job_id,
            eta=eta,
            countdown=countdown,
            headers={"idempotency_key": envelope.idempotency_key},
        )
    except Exception as exc:
        await mark_failed(envelope.job_id, str(exc))
        raise
    return async_result.id


async def mark_enqueued(envelope: JobEnvelope) -> None:
    """Best-effort DB mirror for an enqueued job."""
    try:
        from backend.app.core.db import SessionLocal
        from backend.app.models.jobs import JobModel

        async with SessionLocal() as session:
            existing = await session.get(JobModel, envelope.job_id)
            if existing is None:
                existing = JobModel.from_schema(envelope)
                session.add(existing)
            else:
                existing.job_type = envelope.job_type
                existing.priority = envelope.priority
                existing.run_id = envelope.run_id
                existing.universe_id = envelope.universe_id
                existing.tick = envelope.tick
                existing.attempt_number = envelope.attempt_number
                existing.idempotency_key = envelope.idempotency_key
                existing.artifact_path = envelope.artifact_path
                existing.payload = dict(envelope.payload)
                existing.created_at = envelope.created_at
            existing.status = "queued"
            existing.enqueued_at = eta_or_now(envelope.enqueued_at)
            existing.error = None
            await session.commit()
    except IntegrityError:
        # Re-enqueues can hit the idempotency unique key. The first row remains
        # the authoritative monitor record for that idempotency key.
        try:
            await session.rollback()  # type: ignore[name-defined]
        except Exception:
            pass
    except Exception:
        pass


async def mark_started(job_id: str) -> None:
    await _patch_job(job_id, status="running", started_at=datetime.now(tz=UTC))


async def mark_succeeded(
    job_id: str,
    *,
    result_summary: dict | None = None,
    artifact_path: str | None = None,
) -> None:
    await _patch_job(
        job_id,
        status="succeeded",
        finished_at=datetime.now(tz=UTC),
        result_summary=result_summary,
        artifact_path=artifact_path,
        error=None,
    )


async def mark_failed(job_id: str, error: str) -> None:
    await _patch_job(
        job_id,
        status="failed",
        finished_at=datetime.now(tz=UTC),
        error=error[:4000],
    )


def eta_or_now(value: datetime | None) -> datetime:
    return value or datetime.now(tz=UTC)


async def _patch_job(job_id: str, **fields) -> None:
    """Best-effort update of one job monitor row."""
    try:
        from backend.app.core.db import SessionLocal
        from backend.app.models.jobs import JobModel

        async with SessionLocal() as session:
            row = await session.get(JobModel, job_id)
            if row is None:
                return
            for key, value in fields.items():
                if hasattr(row, key):
                    setattr(row, key, value)
            await session.commit()
    except Exception:
        pass


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


async def clear_running(idempotency_key: str) -> None:
    """Clear an in-progress idempotency claim while preserving done markers."""
    from backend.app.core.redis_client import get_redis_client

    redis = get_redis_client()
    await redis.delete(f"idem:{idempotency_key}")
