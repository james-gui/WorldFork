"""Logs API — PRD §20.6.

Endpoints:
  GET /api/logs/requests
  GET /api/logs/webhooks
  GET /api/logs/errors
  GET /api/logs/audit
  GET /api/logs/traces/{trace_id}
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.db import get_session
from backend.app.models.jobs import JobModel
from backend.app.models.llm_calls import LLMCallModel
from backend.app.schemas.api import (
    AuditLogItem,
    ErrorLogItem,
    JobInfo,
    RequestLogItem,
    TraceResponse,
    WebhookLogItem,
)

router = APIRouter(prefix="/api/logs", tags=["logs"])

_SESSION = Annotated[AsyncSession, Depends(get_session)]
logger = logging.getLogger(__name__)


def _llm_call_to_log_item(row: LLMCallModel) -> RequestLogItem:
    return RequestLogItem(
        call_id=row.call_id,
        provider=row.provider,
        model_used=row.model_used,
        job_type=row.job_type,
        run_id=row.run_id,
        universe_id=row.universe_id,
        tick=row.tick,
        prompt_tokens=row.prompt_tokens,
        completion_tokens=row.completion_tokens,
        total_tokens=row.total_tokens,
        cost_usd=float(row.cost_usd) if row.cost_usd is not None else None,
        latency_ms=row.latency_ms,
        status=row.status,
        error=row.error,
        repaired_once=row.repaired_once,
        created_at=row.created_at,
    )


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
# Request logs
# ---------------------------------------------------------------------------


@router.get(
    "/requests",
    response_model=list[RequestLogItem],
    summary="List LLM request logs",
)
async def get_request_logs(
    session: _SESSION,
    provider: str | None = Query(default=None),
    status: str | None = Query(default=None),
    run_id: str | None = Query(default=None),
    universe_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[RequestLogItem]:
    stmt = select(LLMCallModel)
    if provider:
        stmt = stmt.where(LLMCallModel.provider == provider)
    if status:
        stmt = stmt.where(LLMCallModel.status == status)
    if run_id:
        stmt = stmt.where(LLMCallModel.run_id == run_id)
    if universe_id:
        stmt = stmt.where(LLMCallModel.universe_id == universe_id)
    stmt = stmt.order_by(LLMCallModel.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [_llm_call_to_log_item(r) for r in rows]


# ---------------------------------------------------------------------------
# Webhook logs
# ---------------------------------------------------------------------------


@router.get(
    "/webhooks",
    response_model=list[WebhookLogItem],
    summary="List webhook delivery logs",
)
async def get_webhook_logs(
    session: _SESSION,
    run_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[WebhookLogItem]:
    try:
        from backend.app.models.webhooks import WebhookEventModel

        stmt = select(WebhookEventModel)
        if run_id:
            stmt = stmt.where(WebhookEventModel.run_id == run_id)
        if status:
            stmt = stmt.where(WebhookEventModel.status == status)
        stmt = stmt.order_by(WebhookEventModel.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            WebhookLogItem(
                id=r.id,
                run_id=r.run_id,
                event_type=r.event_type,
                target_url=r.target_url,
                status=r.status,
                attempts=r.attempts,
                last_delivered_at=r.last_delivered_at,
                error=r.error,
                created_at=r.created_at,
            )
            for r in rows
        ]
    except Exception as exc:
        logger.warning("webhook_events table not available: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Error logs
# ---------------------------------------------------------------------------


@router.get(
    "/errors",
    response_model=list[ErrorLogItem],
    summary="List error logs from jobs and LLM calls",
)
async def get_error_logs(
    session: _SESSION,
    run_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[ErrorLogItem]:
    items: list[ErrorLogItem] = []

    # Failed jobs
    job_stmt = select(JobModel).where(JobModel.status == "failed")
    if run_id:
        job_stmt = job_stmt.where(JobModel.run_id == run_id)
    job_stmt = job_stmt.order_by(JobModel.created_at.desc()).limit(limit)
    job_result = await session.execute(job_stmt)
    for r in job_result.scalars().all():
        items.append(ErrorLogItem(
            source="job",
            id=r.job_id,
            job_type=r.job_type,
            provider=None,
            run_id=r.run_id,
            status=r.status,
            error=r.error,
            created_at=r.created_at,
        ))

    # LLM calls with errors
    llm_stmt = select(LLMCallModel).where(LLMCallModel.error.isnot(None))
    if run_id:
        llm_stmt = llm_stmt.where(LLMCallModel.run_id == run_id)
    llm_stmt = llm_stmt.order_by(LLMCallModel.created_at.desc()).limit(limit)
    llm_result = await session.execute(llm_stmt)
    for r in llm_result.scalars().all():
        items.append(ErrorLogItem(
            source="llm_call",
            id=r.call_id,
            job_type=r.job_type,
            provider=r.provider,
            run_id=r.run_id,
            status=r.status,
            error=r.error,
            created_at=r.created_at,
        ))

    # Sort combined by created_at desc and paginate
    items.sort(key=lambda x: (x.created_at or __import__("datetime").datetime.min), reverse=True)
    return items[offset : offset + limit]


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


@router.get(
    "/audit",
    response_model=list[AuditLogItem],
    summary="List audit-style lifecycle log entries",
)
async def get_audit_logs(
    session: _SESSION,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[AuditLogItem]:
    stmt = select(JobModel).order_by(JobModel.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [
        AuditLogItem(
            id=row.job_id,
            actor="worker",
            action=f"job.{row.status}",
            resource=f"job:{row.job_id}",
            timestamp=row.created_at
            or row.enqueued_at
            or row.started_at
            or row.finished_at
            or datetime.now(UTC),
            details={
                "job_type": row.job_type,
                "run_id": row.run_id,
                "universe_id": row.universe_id,
                "tick": row.tick,
                "attempt_number": row.attempt_number,
                "priority": row.priority,
                "error": row.error,
            },
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Traces
# ---------------------------------------------------------------------------


@router.get(
    "/traces/{trace_id}",
    response_model=TraceResponse,
    summary="Get full trace by run, universe, LLM call, or job identifier",
)
async def get_trace(trace_id: str, session: _SESSION) -> TraceResponse:
    llm_stmt = select(LLMCallModel).where(
        or_(
            LLMCallModel.call_id == trace_id,
            LLMCallModel.run_id == trace_id,
            LLMCallModel.universe_id == trace_id,
        )
    )
    llm_result = await session.execute(llm_stmt)
    llm_rows = llm_result.scalars().all()

    job_stmt = select(JobModel).where(
        or_(
            JobModel.job_id == trace_id,
            JobModel.run_id == trace_id,
            JobModel.universe_id == trace_id,
        )
    )
    job_result = await session.execute(job_stmt)
    job_rows = job_result.scalars().all()

    return TraceResponse(
        trace_id=trace_id,
        llm_calls=[_llm_call_to_log_item(r) for r in llm_rows],
        jobs=[_job_to_info(r) for r in job_rows],
    )
