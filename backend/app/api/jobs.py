"""Jobs API — PRD §20.5.

Endpoints:
  GET  /api/jobs/queues
  GET  /api/jobs/workers
  GET  /api/jobs                 (paginated list with filters)
  GET  /api/jobs/{job_id}
  POST /api/jobs/{job_id}/retry
  POST /api/jobs/{job_id}/cancel
  POST /api/jobs/queues/{queue}/pause
  POST /api/jobs/queues/{queue}/resume
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.db import get_session
from backend.app.core.redis_client import get_redis_client
from backend.app.models.jobs import JobModel
from backend.app.schemas.api import (
    CancelResponse,
    JobInfo,
    JobsListResponse,
    QueueInfo,
    QueuePauseResponse,
    QueuesResponse,
    RetryRequest,
    RetryResponse,
    WorkerInfo,
    WorkersResponse,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

_SESSION = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)

_KNOWN_QUEUES = ("p0", "p1", "p2", "p3", "dead_letter")


def _job_to_info(row: JobModel) -> JobInfo:
    return JobInfo(
        job_id=row.job_id,
        job_type=row.job_type,
        priority=row.priority,
        run_id=row.run_id,
        universe_id=row.universe_id,
        tick=row.tick,
        attempt_number=row.attempt_number,
        status=row.status,
        idempotency_key=row.idempotency_key,
        payload=dict(row.payload or {}),
        enqueued_at=row.enqueued_at,
        started_at=row.started_at,
        finished_at=row.finished_at,
        error=row.error,
        result_summary=dict(row.result_summary) if row.result_summary else None,
        artifact_path=row.artifact_path,
        created_at=row.created_at,
    )


# ---------------------------------------------------------------------------
# Queues
# ---------------------------------------------------------------------------


@router.get("/queues", response_model=QueuesResponse, summary="Queue depths and active task counts")
async def get_queues() -> QueuesResponse:
    paused: dict[str, bool] = {}
    try:
        from backend.app.core.redis_client import get_redis_client

        redis = get_redis_client()
        for q in _KNOWN_QUEUES:
            paused[q] = bool(await redis.exists(f"queue_paused:{q}"))
    except Exception:
        paused = {q: False for q in _KNOWN_QUEUES}

    try:
        from backend.app.workers.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=3.0)
        active_raw = inspect.active() or {}
        reserved_raw = inspect.reserved() or {}
        scheduled_raw = inspect.scheduled() or {}

        # Aggregate per queue
        queue_active: dict[str, int] = {}
        queue_reserved: dict[str, int] = {}
        queue_scheduled: dict[str, int] = {}

        for tasks in active_raw.values():
            for task in tasks:
                q = task.get("delivery_info", {}).get("routing_key", "p1")
                queue_active[q] = queue_active.get(q, 0) + 1

        for tasks in reserved_raw.values():
            for task in tasks:
                q = task.get("delivery_info", {}).get("routing_key", "p1")
                queue_reserved[q] = queue_reserved.get(q, 0) + 1

        for tasks in scheduled_raw.values():
            for task in tasks:
                q = task.get("request", {}).get("delivery_info", {}).get("routing_key", "p1")
                queue_scheduled[q] = queue_scheduled.get(q, 0) + 1

        queues = [
            QueueInfo(
                name=q,
                active_task_count=queue_active.get(q, 0),
                reserved_count=queue_reserved.get(q, 0),
                scheduled_count=queue_scheduled.get(q, 0),
                paused=paused.get(q, False),
            )
            for q in _KNOWN_QUEUES
        ]
        return QueuesResponse(queues=queues, degraded=False)

    except Exception as exc:
        logger.warning("Celery inspect failed (broker unreachable?): %s", exc)
        queues = [
            QueueInfo(
                name=q,
                active_task_count=0,
                reserved_count=0,
                scheduled_count=0,
                paused=paused.get(q, False),
            )
            for q in _KNOWN_QUEUES
        ]
        return QueuesResponse(queues=queues, degraded=True, error=str(exc))


# ---------------------------------------------------------------------------
# Workers
# ---------------------------------------------------------------------------


@router.get("/workers", response_model=WorkersResponse, summary="Active Celery worker stats")
async def get_workers() -> WorkersResponse:
    try:
        from backend.app.workers.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=3.0)
        stats_raw = inspect.stats() or {}
        active_raw = inspect.active() or {}

        workers: list[WorkerInfo] = []
        for hostname, stat in stats_raw.items():
            pool_info = stat.get("pool", {})
            pool_name = pool_info.get("implementation", None)
            # Strip module path if present
            if pool_name and "." in pool_name:
                pool_name = pool_name.rsplit(".", 1)[-1]
            processed = stat.get("total", {})
            total_processed = sum(processed.values()) if isinstance(processed, dict) else None
            active_count = len(active_raw.get(hostname, []))
            workers.append(WorkerInfo(
                hostname=hostname,
                pool=pool_name,
                processed=total_processed,
                active=active_count,
            ))

        return WorkersResponse(workers=workers, degraded=False)

    except Exception as exc:
        logger.warning("Celery workers inspect failed: %s", exc)
        return WorkersResponse(workers=[], degraded=True, error=str(exc))


# ---------------------------------------------------------------------------
# Job list
# ---------------------------------------------------------------------------


@router.get("", response_model=JobsListResponse, summary="List jobs with filters")
async def list_jobs(
    session: _SESSION,
    status: str | None = Query(default=None),
    queue: str | None = Query(default=None),
    type: str | None = Query(default=None, alias="type"),
    run_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> JobsListResponse:
    stmt = select(JobModel)
    if status:
        stmt = stmt.where(JobModel.status == status)
    if queue:
        stmt = stmt.where(JobModel.priority == queue)
    if type:
        stmt = stmt.where(JobModel.job_type == type)
    if run_id:
        stmt = stmt.where(JobModel.run_id == run_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.order_by(JobModel.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    rows = result.scalars().all()

    return JobsListResponse(
        jobs=[_job_to_info(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# Job detail
# ---------------------------------------------------------------------------


@router.get("/{job_id}", response_model=JobInfo, summary="Get single job detail")
async def get_job(job_id: str, session: _SESSION) -> JobInfo:
    result = await session.execute(select(JobModel).where(JobModel.job_id == job_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id!r} not found")
    return _job_to_info(row)


# ---------------------------------------------------------------------------
# Retry
# ---------------------------------------------------------------------------


@router.post("/{job_id}/retry", response_model=RetryResponse, summary="Re-enqueue a failed job")
async def retry_job(job_id: str, session: _SESSION, body: RetryRequest | None = None) -> RetryResponse:
    result = await session.execute(select(JobModel).where(JobModel.job_id == job_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id!r} not found")

    new_attempt = row.attempt_number + 1
    new_idempotency_key = f"{row.idempotency_key}:retry:{new_attempt}"
    target_queue = (body.queue if body and body.queue else row.priority) or "p1"

    try:
        from backend.app.workers.queues import Queues

        queue_override = Queues(target_queue)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown queue {target_queue!r}.",
        ) from exc

    from backend.app.workers.scheduler import enqueue, make_envelope

    envelope = make_envelope(
        job_type=row.job_type,  # type: ignore[arg-type]
        run_id=row.run_id,
        universe_id=row.universe_id,
        tick=row.tick,
        payload=dict(row.payload or {}),
        idempotency_key=new_idempotency_key,
        attempt_number=new_attempt,
        priority_override=queue_override,
    )
    try:
        await enqueue(envelope)
    except Exception as exc:
        # mark_enqueued runs before Celery dispatch, so the retry remains
        # visible even when the broker is temporarily unavailable.
        logger.warning("Could not enqueue retry (broker unavailable): %s", exc)

    row.status = "retried"
    await session.commit()

    return RetryResponse(
        new_task_id=envelope.job_id,
        job_id=job_id,
        attempt_number=new_attempt,
    )


# ---------------------------------------------------------------------------
# Cancel
# ---------------------------------------------------------------------------


@router.post("/{job_id}/cancel", response_model=CancelResponse, summary="Cancel a queued or running job")
async def cancel_job(job_id: str, session: _SESSION) -> CancelResponse:
    result = await session.execute(select(JobModel).where(JobModel.job_id == job_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id!r} not found")

    row.status = "cancelled"

    # Advisory revoke — ignore broker errors
    try:
        from backend.app.workers.celery_app import celery_app

        celery_app.control.revoke(row.job_id, terminate=False)
    except Exception as exc:
        logger.warning("Could not revoke task for job %s: %s", job_id, exc)

    await session.commit()
    return CancelResponse(job_id=job_id, status="cancelled")


# ---------------------------------------------------------------------------
# Queue pause / resume
# ---------------------------------------------------------------------------


@router.post("/queues/{queue}/pause", response_model=QueuePauseResponse, summary="Pause a queue (advisory)")
async def pause_queue(queue: str) -> QueuePauseResponse:
    redis = get_redis_client()
    await redis.set(f"queue_paused:{queue}", "true")
    return QueuePauseResponse(queue=queue, paused=True)


@router.post("/queues/{queue}/resume", response_model=QueuePauseResponse, summary="Resume a paused queue")
async def resume_queue(queue: str) -> QueuePauseResponse:
    redis = get_redis_client()
    await redis.delete(f"queue_paused:{queue}")
    return QueuePauseResponse(queue=queue, paused=False)
