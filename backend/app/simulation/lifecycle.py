"""Run and universe lifecycle helpers for completion and results aggregation."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.app.core.clock import now_utc
from backend.app.schemas.jobs import JobEnvelope

TERMINAL_UNIVERSE_STATUSES = {"completed", "frozen", "killed"}


@dataclass
class QuietWindowEvidence:
    quiet: bool
    start_tick: int
    end_tick: int
    event_count: int
    post_count: int
    max_posts_per_tick: int
    reach_total: float
    mobilization_risk: float
    reasons: list[str]

    def model_dump(self) -> dict[str, Any]:
        return {
            "quiet": self.quiet,
            "start_tick": self.start_tick,
            "end_tick": self.end_tick,
            "event_count": self.event_count,
            "post_count": self.post_count,
            "max_posts_per_tick": self.max_posts_per_tick,
            "reach_total": self.reach_total,
            "mobilization_risk": self.mobilization_risk,
            "reasons": list(self.reasons),
        }


def _metric_number(metrics: dict[str, Any], keys: tuple[str, ...], default: float = 0.0) -> float:
    for key in keys:
        value = metrics.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return default


async def compute_quiet_window(
    *,
    session: AsyncSession,
    universe_id: str,
    tick: int,
    metrics: dict[str, Any] | None = None,
    window_ticks: int = 5,
) -> QuietWindowEvidence:
    """Return evidence that the last N ticks have gone quiet.

    Quiet means no new/resolved events in the window, at most one post per tick,
    low total reach, and low current mobilization. The check is intentionally
    conservative so only the god agent can finalize an inactive branch.
    """
    from backend.app.models.events import EventModel
    from backend.app.models.posts import SocialPostModel

    start_tick = max(0, tick - window_ticks + 1)
    reasons: list[str] = []
    if tick < window_ticks:
        reasons.append(f"needs_{window_ticks}_ticks")

    event_count = int(
        (
            await session.execute(
                select(func.count(EventModel.event_id)).where(
                    EventModel.universe_id == universe_id,
                    (
                        (EventModel.created_tick >= start_tick)
                        & (EventModel.created_tick <= tick)
                    )
                    | (
                        (EventModel.scheduled_tick >= start_tick)
                        & (EventModel.scheduled_tick <= tick)
                    ),
                )
            )
        ).scalar_one()
        or 0
    )
    if event_count:
        reasons.append("events_present")

    post_rows = (
        await session.execute(
            select(
                SocialPostModel.tick_created,
                func.count(SocialPostModel.post_id),
                func.coalesce(func.sum(SocialPostModel.reach_score), 0.0),
            )
            .where(
                SocialPostModel.universe_id == universe_id,
                SocialPostModel.tick_created >= start_tick,
                SocialPostModel.tick_created <= tick,
            )
            .group_by(SocialPostModel.tick_created)
        )
    ).all()
    post_count = 0
    max_posts_per_tick = 0
    reach_total = 0.0
    for _row_tick, count, reach in post_rows:
        count_i = int(count or 0)
        post_count += count_i
        max_posts_per_tick = max(max_posts_per_tick, count_i)
        try:
            reach_total += float(reach or 0.0)
        except (TypeError, ValueError):
            pass

    if max_posts_per_tick > 1:
        reasons.append("posting_not_dormant")
    if reach_total > float(window_ticks) * 0.5:
        reasons.append("reach_not_low")

    metrics = metrics or {}
    mobilization_risk = _metric_number(
        metrics,
        ("mobilization_risk", "mobilization", "mobilizationRisk"),
        0.0,
    )
    if mobilization_risk > 0.2:
        reasons.append("mobilization_not_low")

    quiet = (
        tick >= window_ticks
        and event_count == 0
        and max_posts_per_tick <= 1
        and reach_total <= float(window_ticks) * 0.5
        and mobilization_risk <= 0.2
    )
    return QuietWindowEvidence(
        quiet=quiet,
        start_tick=start_tick,
        end_tick=tick,
        event_count=event_count,
        post_count=post_count,
        max_posts_per_tick=max_posts_per_tick,
        reach_total=reach_total,
        mobilization_risk=mobilization_risk,
        reasons=reasons,
    )


async def apply_universe_completion_decision(
    *,
    session: AsyncSession,
    run: Any,
    universe: Any,
    tick: int,
    god_decision: dict[str, Any] | None,
    metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Apply max-tick or god-confirmed quiet completion to one universe."""
    if universe.status in TERMINAL_UNIVERSE_STATUSES:
        return {"completed": False, "reason": f"already_{universe.status}"}

    max_ticks = int(getattr(run, "max_ticks", 0) or 0)
    if max_ticks and tick >= max_ticks:
        universe.status = "completed"
        universe.completed_at = now_utc()
        return {"completed": True, "reason": "max_ticks_reached"}

    decision = str((god_decision or {}).get("decision") or "")
    if decision != "complete_universe":
        return {"completed": False, "reason": "god_did_not_complete"}

    evidence = await compute_quiet_window(
        session=session,
        universe_id=universe.universe_id,
        tick=tick,
        metrics=metrics or {},
    )
    if not evidence.quiet:
        return {
            "completed": False,
            "reason": "quiet_window_not_met",
            "quiet_window": evidence.model_dump(),
        }

    universe.status = "completed"
    universe.completed_at = now_utc()
    return {
        "completed": True,
        "reason": "god_completed_quiet_window",
        "quiet_window": evidence.model_dump(),
    }


async def prepare_results_job_if_run_terminal(
    *,
    session: AsyncSession,
    run_id: str,
    reason: str = "all_universes_terminal",
) -> JobEnvelope | None:
    """Mark the run completed and return a results aggregation envelope if due.

    The caller owns the transaction and must enqueue the returned envelope only
    after committing the DB state.
    """
    from backend.app.models.jobs import JobModel
    from backend.app.models.results import RunResultModel
    from backend.app.models.runs import BigBangRunModel
    from backend.app.models.universes import UniverseModel
    from backend.app.workers.scheduler import make_envelope

    run = await session.get(BigBangRunModel, run_id)
    if run is None:
        return None

    universes = list(
        (
            await session.execute(
                select(UniverseModel).where(UniverseModel.big_bang_id == run_id)
            )
        )
        .scalars()
        .all()
    )
    if not universes:
        return None
    if any(u.status not in TERMINAL_UNIVERSE_STATUSES for u in universes):
        return None

    if run.status != "completed":
        run.status = "completed"
        meta = dict(run.safe_edit_metadata or {})
        meta["completion_reason"] = reason
        meta["completed_at"] = now_utc().isoformat()
        run.safe_edit_metadata = meta
        try:
            flag_modified(run, "safe_edit_metadata")
        except Exception:
            pass

    result_row = await session.get(RunResultModel, run_id)
    if result_row is not None and result_row.status in {"pending", "running", "succeeded"}:
        return None
    if result_row is None:
        result_row = RunResultModel(
            run_id=run_id,
            status="pending",
            classifications={},
            branch_clusters=[],
            universe_outcomes=[],
            timeline_highlights=[],
            metrics={},
        )
        session.add(result_row)
    else:
        result_row.status = "pending"
        result_row.error = None

    existing_job = (
        await session.execute(
            select(JobModel)
            .where(
                JobModel.run_id == run_id,
                JobModel.job_type == "aggregate_run_results",
                JobModel.status.in_(["queued", "running", "succeeded"]),
            )
            .order_by(JobModel.created_at.desc())
        )
    ).scalars().first()
    if existing_job is not None:
        result_row.job_id = existing_job.job_id
        return None

    envelope = make_envelope(
        job_type="aggregate_run_results",
        run_id=run_id,
        payload={"run_id": run_id, "reason": reason},
        idempotency_key=f"aggregate_run_results:{run_id}:auto",
    )
    result_row.job_id = envelope.job_id
    return envelope
