"""
JobModel — mirrors JobEnvelope + JobStatus.
Table: jobs
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base

if TYPE_CHECKING:
    from backend.app.schemas.jobs import JobEnvelope


class JobModel(Base):
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)

    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    priority: Mapped[str] = mapped_column(String(32), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    universe_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tick: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")

    enqueued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_jobs_status_priority", "status", "priority"),
        Index("ix_jobs_run_universe_tick", "run_id", "universe_id", "tick"),
        Index("ix_jobs_type_status", "job_type", "status"),
    )

    def to_schema(self) -> JobEnvelope:
        from backend.app.schemas.jobs import JobEnvelope

        return JobEnvelope(
            job_id=self.job_id,
            job_type=self.job_type,  # type: ignore[arg-type]
            priority=self.priority,  # type: ignore[arg-type]
            run_id=self.run_id,
            universe_id=self.universe_id,
            tick=self.tick,
            attempt_number=self.attempt_number,
            idempotency_key=self.idempotency_key,
            artifact_path=self.artifact_path,
            payload=dict(self.payload or {}),
            created_at=self.created_at,  # type: ignore[arg-type]
            enqueued_at=self.enqueued_at,
        )

    @classmethod
    def from_schema(cls, s: JobEnvelope) -> JobModel:
        return cls(
            job_id=s.job_id,
            job_type=s.job_type,
            priority=s.priority,
            run_id=s.run_id,
            universe_id=s.universe_id,
            tick=s.tick,
            attempt_number=s.attempt_number,
            idempotency_key=s.idempotency_key,
            artifact_path=s.artifact_path,
            payload=dict(s.payload),
            created_at=s.created_at,
            enqueued_at=s.enqueued_at,
            status="queued",
        )
