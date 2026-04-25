"""Per-job-type routing table — PRD §16.4.

Loads :class:`ModelRoutingEntry` rows from the database (or falls back to
hardcoded defaults derived from the PRD example) and exposes ``route(job_type)``
which returns ``(preferred ModelConfig, fallback ModelConfig | None)``.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from backend.app.schemas.jobs import JobType
from backend.app.schemas.llm import ModelConfig
from backend.app.schemas.settings import ModelRoutingEntry

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Defaults — derived from PRD §16.4 example, generalised across job types.
# ---------------------------------------------------------------------------

_AGENT_MODEL = "deepseek/deepseek-v3.2"
_AGENT_FALLBACK_MODEL = "openai/gpt-4o-mini"
_GOD_MODEL = "openai/gpt-5.5"
_GOD_FALLBACK_MODEL = "openai/gpt-5.4"


def _default_entry(job_type: JobType) -> ModelRoutingEntry:
    """Return a sane default :class:`ModelRoutingEntry` for *job_type*."""
    if job_type in {"god_agent_review", "aggregate_run_results", "force_deviation"}:
        preferred = _GOD_MODEL
        fallback = _GOD_FALLBACK_MODEL
    else:
        preferred = _AGENT_MODEL
        fallback = _AGENT_FALLBACK_MODEL
    return ModelRoutingEntry(
        job_type=job_type,
        preferred_provider="openrouter",
        preferred_model=preferred,
        fallback_provider="openrouter" if fallback else None,
        fallback_model=fallback,
        temperature=0.6,
        top_p=0.95,
        max_tokens=2048,
        max_concurrency=4,
        requests_per_minute=60,
        tokens_per_minute=150_000,
        timeout_seconds=120,
        retry_policy="exponential_backoff",
        daily_budget_usd=None,
    )


_ALL_JOB_TYPES: tuple[JobType, ...] = (
    "initialize_big_bang",
    "simulate_universe_tick",
    "agent_deliberation_batch",
    "execute_due_events",
    "social_propagation",
    "sociology_update",
    "god_agent_review",
    "branch_universe",
    "sync_zep_memory",
    "build_review_index",
    "export_run",
    "apply_tick_results",
    "aggregate_run_results",
    "force_deviation",
)


# ---------------------------------------------------------------------------
# RoutingTable
# ---------------------------------------------------------------------------

class RoutingTable:
    """In-memory routing table keyed by job type."""

    def __init__(self, entries: dict[JobType, ModelRoutingEntry]) -> None:
        self._entries: dict[JobType, ModelRoutingEntry] = dict(entries)

    # ------------------------------------------------------------------
    # Resolve
    # ------------------------------------------------------------------

    def route(self, job_type: JobType) -> tuple[ModelConfig, ModelConfig | None]:
        """Return ``(preferred ModelConfig, fallback ModelConfig | None)``."""
        entry = self._entries.get(job_type)
        if entry is None:
            entry = _default_entry(job_type)

        preferred = ModelConfig(
            provider=entry.preferred_provider,
            model=entry.preferred_model,
            fallback_model=None,
            temperature=entry.temperature,
            top_p=entry.top_p,
            max_tokens=entry.max_tokens,
            response_format=None,
            tools=None,
            timeout_seconds=entry.timeout_seconds,
            retry_policy=entry.retry_policy,
        )

        fallback: ModelConfig | None = None
        if entry.fallback_model and entry.fallback_provider:
            fallback = ModelConfig(
                provider=entry.fallback_provider,
                model=entry.fallback_model,
                fallback_model=None,
                temperature=entry.temperature,
                top_p=entry.top_p,
                max_tokens=entry.max_tokens,
                response_format=None,
                tools=None,
                timeout_seconds=entry.timeout_seconds,
                retry_policy=entry.retry_policy,
            )

        return preferred, fallback

    # ------------------------------------------------------------------
    # Constructors
    # ------------------------------------------------------------------

    @classmethod
    def defaults(cls) -> RoutingTable:
        """Return a routing table populated with PRD-derived defaults for every job type."""
        entries = {jt: _default_entry(jt) for jt in _ALL_JOB_TYPES}
        return cls(entries)

    @classmethod
    async def from_db(cls, session: AsyncSession) -> RoutingTable:
        """Load routing entries from the ``settings_model_routing`` table.

        Falls back to :meth:`defaults` if the table is empty or unavailable.
        """
        try:
            from sqlalchemy import text  # local import to keep this module import-light
        except Exception:
            return cls.defaults()

        try:
            result = await session.execute(
                text(
                    "SELECT job_type, preferred_provider, preferred_model, "
                    "fallback_provider, fallback_model, temperature, top_p, "
                    "max_tokens, max_concurrency, requests_per_minute, "
                    "tokens_per_minute, timeout_seconds, retry_policy, "
                    "daily_budget_usd FROM settings_model_routing"
                )
            )
            rows = result.mappings().all()
        except Exception:
            return cls.defaults()

        if not rows:
            return cls.defaults()

        entries: dict[JobType, ModelRoutingEntry] = {}
        for row in rows:
            try:
                entry = ModelRoutingEntry(**dict(row))
            except Exception:
                continue
            entries[entry.job_type] = entry
        # Backfill missing job types with defaults so route() never returns None for known jobs.
        for jt in _ALL_JOB_TYPES:
            entries.setdefault(jt, _default_entry(jt))
        return cls(entries)
