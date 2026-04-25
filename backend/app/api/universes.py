"""Universes REST API — §20.2.

Endpoints:
  GET   /api/universes/{universe_id}
  POST  /api/universes/{universe_id}/pause
  POST  /api/universes/{universe_id}/resume
  POST  /api/universes/{universe_id}/step
  POST  /api/universes/{universe_id}/branch-preview
  POST  /api/universes/{universe_id}/branch
  GET   /api/universes/{universe_id}/ticks/{tick}
  GET   /api/universes/{universe_id}/lineage
  GET   /api/universes/{universe_id}/descendants
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.clock import now_utc
from backend.app.core.db import get_session
from backend.app.core.ids import new_id
from backend.app.models.cohorts import CohortStateModel
from backend.app.models.runs import BigBangRunModel
from backend.app.models.universes import UniverseModel
from backend.app.schemas.api import (
    BranchPreviewRequest,
    BranchPreviewResponse,
    BranchRequest,
    BranchResponse,
    DescendantsResponse,
    LineageResponse,
    StepRequest,
    TickArtifactResponse,
    UniverseDetail,
)
from backend.app.workers.scheduler import enqueue, make_envelope

router = APIRouter(prefix="/api/universes", tags=["universes"])

DbSession = Annotated[AsyncSession, Depends(get_session)]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_universe_or_404(universe_id: str, session: AsyncSession) -> UniverseModel:
    result = await session.execute(
        select(UniverseModel).where(UniverseModel.universe_id == universe_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Universe {universe_id!r} not found.")
    return row


def _universe_to_detail(uni: UniverseModel, active_cohort_count: int = 0) -> UniverseDetail:
    return UniverseDetail(
        universe_id=uni.universe_id,
        big_bang_id=uni.big_bang_id,
        parent_universe_id=uni.parent_universe_id,
        child_universe_ids=[],  # populated separately
        branch_from_tick=uni.branch_from_tick or 0,
        branch_depth=uni.branch_depth,
        lineage_path=list(uni.lineage_path or []),
        status=uni.status,
        branch_reason=uni.branch_reason or "",
        current_tick=uni.current_tick,
        latest_metrics=dict(uni.latest_metrics or {}),
        created_at=uni.created_at,
        frozen_at=uni.frozen_at,
        killed_at=uni.killed_at,
        completed_at=uni.completed_at,
        active_cohort_count=active_cohort_count,
        branch_summary={},
    )


async def _get_run_folder(universe: UniverseModel, session: AsyncSession) -> Path | None:
    run_result = await session.execute(
        select(BigBangRunModel).where(BigBangRunModel.big_bang_id == universe.big_bang_id)
    )
    run = run_result.scalar_one_or_none()
    if run and run.run_folder_path:
        p = Path(run.run_folder_path)
        if p.exists():
            return p
    return None


# ---------------------------------------------------------------------------
# GET /api/universes/{universe_id}
# ---------------------------------------------------------------------------


@router.get("/{universe_id}", response_model=UniverseDetail)
async def get_universe(universe_id: str, session: DbSession) -> UniverseDetail:
    uni = await _get_universe_or_404(universe_id, session)

    # Count active cohorts at the latest tick.
    cohort_count = (
        await session.execute(
            select(func.count(CohortStateModel.cohort_id)).where(
                CohortStateModel.universe_id == universe_id,
                CohortStateModel.tick == uni.current_tick,
                CohortStateModel.is_active == True,  # noqa: E712
            )
        )
    ).scalar_one()

    # Build child universe id list.
    children_result = await session.execute(
        select(UniverseModel.universe_id).where(
            UniverseModel.parent_universe_id == universe_id
        )
    )
    child_ids = [r[0] for r in children_result.all()]

    detail = _universe_to_detail(uni, active_cohort_count=cohort_count)
    detail = detail.model_copy(update={"child_universe_ids": child_ids})
    return detail


# ---------------------------------------------------------------------------
# POST /api/universes/{universe_id}/pause
# ---------------------------------------------------------------------------


@router.post("/{universe_id}/pause", status_code=200)
async def pause_universe(universe_id: str, session: DbSession) -> dict:
    """Flip universe status to 'frozen' and record frozen_at timestamp."""
    uni = await _get_universe_or_404(universe_id, session)

    if uni.status not in ("active", "candidate"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot pause a universe in status '{uni.status}'.",
        )

    uni.status = "frozen"
    uni.frozen_at = now_utc()
    await session.commit()
    return {"universe_id": universe_id, "status": "frozen"}


# ---------------------------------------------------------------------------
# POST /api/universes/{universe_id}/resume
# ---------------------------------------------------------------------------


@router.post("/{universe_id}/resume", status_code=200)
async def resume_universe(universe_id: str, session: DbSession) -> dict:
    """Flip universe status back to 'active' and enqueue the next tick."""
    uni = await _get_universe_or_404(universe_id, session)

    if uni.status != "frozen":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot resume a universe in status '{uni.status}'.",
        )

    uni.status = "active"
    uni.frozen_at = None
    await session.commit()

    # Enqueue next tick.
    envelope = make_envelope(
        job_type="simulate_universe_tick",
        run_id=uni.big_bang_id,
        universe_id=universe_id,
        tick=uni.current_tick + 1,
        payload={"universe_id": universe_id, "tick": uni.current_tick + 1},
    )
    try:
        await enqueue(envelope)
    except Exception:
        pass

    return {"universe_id": universe_id, "status": "active", "next_tick": uni.current_tick + 1}


# ---------------------------------------------------------------------------
# POST /api/universes/{universe_id}/step
# ---------------------------------------------------------------------------


@router.post("/{universe_id}/step", status_code=202)
async def step_universe(
    universe_id: str, body: StepRequest, session: DbSession
) -> dict:
    """Enqueue exactly one ``simulate_universe_tick`` job.

    Falls back to running the tick inline via
    :func:`backend.app.simulation.local_runner.run_tick_locally` when the
    Celery broker is unreachable — this keeps the dev workflow working
    without a worker container.
    """
    uni = await _get_universe_or_404(universe_id, session)
    target_tick = body.tick if body.tick is not None else uni.current_tick + 1

    envelope = make_envelope(
        job_type="simulate_universe_tick",
        run_id=uni.big_bang_id,
        universe_id=universe_id,
        tick=target_tick,
        payload={"universe_id": universe_id, "tick": target_tick},
    )
    job_id = envelope.job_id

    enqueued_via_celery = False
    try:
        await enqueue(envelope)
        enqueued_via_celery = True
    except Exception:
        # Broker unreachable — fall through to the local runner.
        enqueued_via_celery = False

    local_summary: dict | None = None
    if not enqueued_via_celery:
        try:
            local_summary = await _run_tick_locally_for_step(
                run_id=uni.big_bang_id,
                universe_id=universe_id,
                tick=target_tick,
                session=session,
            )
        except Exception:  # pragma: no cover — best effort
            local_summary = None

    return {
        "job_id": job_id,
        "universe_id": universe_id,
        "tick": target_tick,
        "enqueued_via_celery": enqueued_via_celery,
        "local_summary": local_summary,
    }


async def _run_tick_locally_for_step(
    *,
    run_id: str,
    universe_id: str,
    tick: int,
    session: AsyncSession,
) -> dict:
    """Helper used by ``/step`` when Celery is unavailable.

    Builds the supporting plumbing (routing table, rate limiter, ledger)
    and delegates to :func:`local_runner.run_tick_locally`.
    """
    from backend.app.core.config import settings as _cfg
    from backend.app.core.redis_client import get_redis_client
    from backend.app.providers.rate_limits import ProviderRateLimiter
    from backend.app.providers.routing import RoutingTable
    from backend.app.simulation.local_runner import run_tick_locally
    from backend.app.simulation.tick_runner import TickContext
    from backend.app.storage.ledger import Ledger

    try:
        routing = await RoutingTable.from_db(session)
    except Exception:
        routing = RoutingTable.defaults()

    redis = get_redis_client()
    limiter = ProviderRateLimiter(
        redis,
        provider="openrouter",
        rpm_limit=600,
        tpm_limit=1_000_000,
        max_concurrency=8,
        daily_budget_usd=None,
        jitter=False,
    )

    run_root = _cfg.run_root
    if run_root.name == "runs":
        run_root = run_root.parent
    try:
        ledger = Ledger.open(run_root, run_id)
    except Exception:
        return {"status": "no_ledger"}

    ctx = TickContext(
        run_id=run_id,
        universe_id=universe_id,
        tick=tick,
        attempt_number=1,
    )
    return await run_tick_locally(
        ctx,
        session=session,
        ledger=ledger,
        routing=routing,
        limiter=limiter,
        memory=None,
    )


# ---------------------------------------------------------------------------
# POST /api/universes/{universe_id}/branch-preview
# ---------------------------------------------------------------------------


@router.post("/{universe_id}/branch-preview", response_model=BranchPreviewResponse)
async def branch_preview(
    universe_id: str, body: BranchPreviewRequest, session: DbSession
) -> BranchPreviewResponse:
    """Check whether a branch delta would be approved by branch policy.

    B4-A (branch_policy) not yet integrated — returns a placeholder approval.
    """
    # Verify universe exists.
    await _get_universe_or_404(universe_id, session)

    # B4-A placeholder: always approve.
    return BranchPreviewResponse(
        approved=True,
        downgraded=False,
        rejection_reason=None,
        policy_checks=[],
        note="Branch policy engine (B4-A) not yet integrated — placeholder result.",
    )


# ---------------------------------------------------------------------------
# POST /api/universes/{universe_id}/branch
# ---------------------------------------------------------------------------


@router.post("/{universe_id}/branch", status_code=202, response_model=BranchResponse)
async def branch_universe(
    universe_id: str, body: BranchRequest, session: DbSession
) -> BranchResponse:
    """Enqueue a branch_universe job.

    B4-B (branch_engine) not yet integrated — returns a placeholder candidate id.
    """
    uni = await _get_universe_or_404(universe_id, session)

    candidate_universe_id = new_id("uni")

    envelope = make_envelope(
        job_type="branch_universe",
        run_id=uni.big_bang_id,
        universe_id=universe_id,
        payload={
            "parent_universe_id": universe_id,
            "candidate_universe_id": candidate_universe_id,
            "delta": body.delta,
            "reason": body.reason,
        },
    )
    job_id = envelope.job_id
    try:
        await enqueue(envelope)
    except Exception:
        pass

    return BranchResponse(
        candidate_universe_id=candidate_universe_id,
        job_id=job_id,
        note="Branch engine (B4-B) not yet integrated — placeholder universe id.",
    )


# ---------------------------------------------------------------------------
# GET /api/universes/{universe_id}/ticks/{tick}
# ---------------------------------------------------------------------------


@router.get("/{universe_id}/ticks/{tick}", response_model=TickArtifactResponse)
async def get_tick_artifact(
    universe_id: str, tick: int, session: DbSession
) -> TickArtifactResponse:
    """Read tick artifacts from the ledger file system."""
    uni = await _get_universe_or_404(universe_id, session)

    run_folder = await _get_run_folder(uni, session)

    parsed_decisions: list[dict] = []
    social_posts: list[dict] = []
    state_after: dict = {}
    god_decision: dict | None = None
    metrics: dict = {}

    if run_folder is not None:
        tick_dir = run_folder / "universes" / universe_id / "ticks" / f"tick_{tick:03d}"

        if not tick_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Tick {tick} artifacts not found for universe {universe_id!r}.",
            )

        # Parsed decisions (JSONL under visible_packets or events).
        decisions_file = tick_dir / "parsed_decisions.jsonl"
        if decisions_file.exists():
            for line in decisions_file.read_text().splitlines():
                line = line.strip()
                if line:
                    try:
                        parsed_decisions.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        # Social posts (JSONL).
        posts_file = tick_dir / "social_posts" / "posts.jsonl"
        if posts_file.exists():
            for line in posts_file.read_text().splitlines():
                line = line.strip()
                if line:
                    try:
                        social_posts.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        # State after (JSON).
        state_file = tick_dir / "state_after.json"
        if state_file.exists():
            try:
                state_after = json.loads(state_file.read_bytes())
            except Exception:
                pass

        # God decision.
        god_file = tick_dir / "god" / "decision.json"
        if god_file.exists():
            try:
                god_decision = json.loads(god_file.read_bytes())
            except Exception:
                pass

        # Metrics.
        metrics_file = tick_dir / "metrics.json"
        if metrics_file.exists():
            try:
                metrics = json.loads(metrics_file.read_bytes())
            except Exception:
                pass
    else:
        # No run folder yet (draft run) — return empty artifact.
        if tick > uni.current_tick:
            raise HTTPException(
                status_code=404,
                detail=f"Tick {tick} not yet available for universe {universe_id!r}.",
            )

    return TickArtifactResponse(
        universe_id=universe_id,
        tick=tick,
        parsed_decisions=parsed_decisions,
        social_posts=social_posts,
        state_after=state_after,
        god_decision=god_decision,
        metrics=metrics,
    )


# ---------------------------------------------------------------------------
# GET /api/universes/{universe_id}/lineage
# ---------------------------------------------------------------------------


@router.get("/{universe_id}/lineage", response_model=LineageResponse)
async def get_lineage(universe_id: str, session: DbSession) -> LineageResponse:
    uni = await _get_universe_or_404(universe_id, session)
    return LineageResponse(
        lineage_path=list(uni.lineage_path or [universe_id]),
        parent=uni.parent_universe_id,
        depth=uni.branch_depth,
        branch_from_tick=uni.branch_from_tick,
    )


# ---------------------------------------------------------------------------
# GET /api/universes/{universe_id}/descendants
# ---------------------------------------------------------------------------


@router.get("/{universe_id}/descendants", response_model=DescendantsResponse)
async def get_descendants(universe_id: str, session: DbSession) -> DescendantsResponse:
    """Return a nested tree of all descendants."""
    uni = await _get_universe_or_404(universe_id, session)

    # Fetch all universes under the same big_bang_id to build the tree in Python.
    all_unis_result = await session.execute(
        select(UniverseModel).where(UniverseModel.big_bang_id == uni.big_bang_id)
    )
    all_unis = all_unis_result.scalars().all()

    # Build parent → children map.
    children_map: dict[str, list[UniverseModel]] = {}
    for u in all_unis:
        pid = u.parent_universe_id
        children_map.setdefault(pid or "__root__", []).append(u)

    def _build_node(u: UniverseModel) -> DescendantsResponse:
        child_nodes = [
            _build_node(c) for c in children_map.get(u.universe_id, [])
        ]
        return DescendantsResponse(
            universe_id=u.universe_id,
            status=u.status,
            depth=u.branch_depth,
            current_tick=u.current_tick,
            children=child_nodes,
        )

    return _build_node(uni)
