"""RunResultModel — one synthesized results dashboard per Big Bang run."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base, TimestampMixin


class RunResultModel(Base, TimestampMixin):
    __tablename__ = "run_results"

    run_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("big_bang_runs.big_bang_id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    classifications: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    branch_clusters: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    universe_outcomes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline_highlights: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    artifact_path: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
