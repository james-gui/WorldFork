"""
LLMCallModel — mirrors LLMResult.
Table: llm_calls
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.models.base import Base

if TYPE_CHECKING:
    from backend.app.schemas.llm import LLMResult


class LLMCallModel(Base):
    __tablename__ = "llm_calls"

    call_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model_used: Mapped[str] = mapped_column(String(128), nullable=False)
    job_type: Mapped[str] = mapped_column(String(64), nullable=False)

    prompt_packet_path: Mapped[str] = mapped_column(String, nullable=False)
    prompt_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_path: Mapped[str] = mapped_column(String, nullable=False)
    parsed_path: Mapped[str | None] = mapped_column(String, nullable=True)

    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    repaired_once: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    run_id: Mapped[str] = mapped_column(String(64), nullable=False)
    universe_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tick: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_llm_calls_run_created_at", "run_id", "created_at"),
        Index("ix_llm_calls_job_type_status", "job_type", "status"),
    )

    def to_schema(self) -> LLMResult:
        from backend.app.schemas.llm import LLMResult

        return LLMResult(
            call_id=self.call_id,
            provider=self.provider,
            model_used=self.model_used,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            total_tokens=self.total_tokens,
            cost_usd=float(self.cost_usd) if self.cost_usd is not None else None,
            latency_ms=self.latency_ms,
            created_at=self.created_at,
            repaired_once=self.repaired_once,
        )

    @classmethod
    def from_schema(
        cls,
        s: LLMResult,
        *,
        job_type: str,
        prompt_packet_path: str,
        prompt_hash: str,
        response_path: str,
        run_id: str,
        status: str = "succeeded",
        universe_id: str | None = None,
        tick: int | None = None,
        parsed_path: str | None = None,
    ) -> LLMCallModel:
        return cls(
            call_id=s.call_id,
            provider=s.provider,
            model_used=s.model_used,
            job_type=job_type,
            prompt_packet_path=prompt_packet_path,
            prompt_hash=prompt_hash,
            response_path=response_path,
            parsed_path=parsed_path,
            prompt_tokens=s.prompt_tokens,
            completion_tokens=s.completion_tokens,
            total_tokens=s.total_tokens,
            cost_usd=s.cost_usd,
            latency_ms=s.latency_ms,
            repaired_once=s.repaired_once,
            status=status,
            created_at=s.created_at,
            run_id=run_id,
            universe_id=universe_id,
            tick=tick,
        )
