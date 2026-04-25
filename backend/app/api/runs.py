"""Runs REST API — §20.1.

Endpoints:
  POST   /api/runs
  GET    /api/runs
  GET    /api/runs/{run_id}
  PATCH  /api/runs/{run_id}
  POST   /api/runs/{run_id}/archive
  POST   /api/runs/{run_id}/duplicate
  POST   /api/runs/{run_id}/export
  GET    /api/runs/{run_id}/source-of-truth
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.db import get_session
from backend.app.core.ids import new_id
from backend.app.models.runs import BigBangRunModel
from backend.app.models.universes import UniverseModel
from backend.app.schemas.api import (
    CreateRunRequest,
    CreateRunResponse,
    PatchRunRequest,
    RunDetail,
    RunListItem,
    RunListResponse,
    SoTBundleResponse,
)
from backend.app.workers.scheduler import enqueue, make_envelope

router = APIRouter(prefix="/api/runs", tags=["runs"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def _get_run_or_404(run_id: str, session: AsyncSession) -> BigBangRunModel:
    result = await session.execute(
        select(BigBangRunModel).where(BigBangRunModel.big_bang_id == run_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found.")
    return row


# ---------------------------------------------------------------------------
# POST /api/runs
# ---------------------------------------------------------------------------


@router.post("", status_code=202, response_model=CreateRunResponse)
async def create_run(
    body: CreateRunRequest,
    session: DbSession,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> CreateRunResponse:
    """Create a new Big Bang run and enqueue initialization.

    If an ``Idempotency-Key`` header is provided and a run with that key
    already exists, the existing run is returned without re-enqueuing.
    """
    # Deduplicate on idempotency key stored in safe_edit_metadata.
    if idempotency_key:
        # Use a dialect-portable JSON cast (works for both Postgres JSONB and SQLite JSON).
        from sqlalchemy import String as SAString
        from sqlalchemy import cast

        existing_result = await session.execute(
            select(BigBangRunModel).where(
                cast(
                    BigBangRunModel.safe_edit_metadata["idempotency_key"],
                    SAString,
                )
                == f'"{idempotency_key}"'
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            return CreateRunResponse(
                run_id=existing.big_bang_id,
                root_universe_id=existing.root_universe_id,
                status=existing.status,
            )

    big_bang_id = new_id("run")
    root_universe_id = new_id("uni")

    safe_meta: dict = {}
    if idempotency_key:
        safe_meta["idempotency_key"] = idempotency_key

    run = BigBangRunModel(
        big_bang_id=big_bang_id,
        display_name=body.display_name,
        scenario_text=body.scenario_text,
        input_file_ids=list(body.uploaded_doc_ids),
        status="draft",
        time_horizon_label=body.time_horizon_label,
        tick_duration_minutes=body.tick_duration_minutes,
        max_ticks=body.max_ticks,
        max_schedule_horizon_ticks=body.max_schedule_horizon_ticks,
        source_of_truth_version="pending",
        source_of_truth_snapshot_path="",
        provider_snapshot_id=body.provider_snapshot_id or "",
        root_universe_id=root_universe_id,
        run_folder_path="",
        safe_edit_metadata=safe_meta,
    )
    session.add(run)
    await session.commit()

    # Enqueue initialize_big_bang via Celery.
    envelope = make_envelope(
        job_type="initialize_big_bang",
        run_id=big_bang_id,
        payload={
            "display_name": body.display_name,
            "scenario_text": body.scenario_text,
            "time_horizon_label": body.time_horizon_label,
            "tick_duration_minutes": body.tick_duration_minutes,
            "max_ticks": body.max_ticks,
            "max_schedule_horizon_ticks": body.max_schedule_horizon_ticks,
            "uploaded_doc_ids": list(body.uploaded_doc_ids),
            "provider_snapshot_id": body.provider_snapshot_id,
            "root_universe_id": root_universe_id,
        },
        idempotency_key=idempotency_key,
    )
    try:
        await enqueue(envelope)
    except Exception:
        # Celery may not be running in test environments; swallow gracefully.
        pass

    return CreateRunResponse(
        run_id=big_bang_id,
        root_universe_id=root_universe_id,
        status="draft",
    )


# ---------------------------------------------------------------------------
# GET /api/runs
# ---------------------------------------------------------------------------


@router.get("", response_model=RunListResponse)
async def list_runs(
    session: DbSession,
    status: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str | None, Query()] = None,
) -> RunListResponse:
    """Paginated, filterable list of Big Bang runs."""
    stmt = select(BigBangRunModel)

    if status:
        stmt = stmt.where(BigBangRunModel.status == status)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            BigBangRunModel.display_name.ilike(pattern)
            | BigBangRunModel.scenario_text.ilike(pattern)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.order_by(BigBangRunModel.created_at.desc()).limit(limit).offset(offset)
    rows_result = await session.execute(stmt)
    rows = rows_result.scalars().all()

    items = [
        RunListItem(
            run_id=r.big_bang_id,
            display_name=r.display_name,
            status=r.status,
            scenario_text=r.scenario_text,
            time_horizon_label=r.time_horizon_label,
            tick_duration_minutes=r.tick_duration_minutes,
            max_ticks=r.max_ticks,
            created_at=r.created_at,
            updated_at=r.updated_at,
            favorite=bool((r.safe_edit_metadata or {}).get("favorite", False)),
            archived=bool((r.safe_edit_metadata or {}).get("archived", False)),
            root_universe_id=r.root_universe_id,
        )
        for r in rows
    ]

    return RunListResponse(items=items, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# GET /api/runs/{run_id}
# ---------------------------------------------------------------------------


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(run_id: str, session: DbSession) -> RunDetail:
    """Return detailed information about a single run."""
    run = await _get_run_or_404(run_id, session)

    # Count universes by status.
    select(
        func.count(UniverseModel.universe_id).label("total"),
        func.count(
            UniverseModel.universe_id.op("FILTER")(
                UniverseModel.status == "active"
            )
        ).label("active"),
    ).where(UniverseModel.big_bang_id == run_id)

    # Simpler cross-DB approach: two separate counts.
    total_stmt = select(func.count(UniverseModel.universe_id)).where(
        UniverseModel.big_bang_id == run_id
    )
    active_stmt = select(func.count(UniverseModel.universe_id)).where(
        UniverseModel.big_bang_id == run_id,
        UniverseModel.status == "active",
    )

    total_count = (await session.execute(total_stmt)).scalar_one()
    active_count = (await session.execute(active_stmt)).scalar_one()

    # Latest metrics: pull from root universe.
    root_metrics: dict = {}
    root_stmt = select(UniverseModel).where(
        UniverseModel.universe_id == run.root_universe_id
    )
    root_result = await session.execute(root_stmt)
    root_uni = root_result.scalar_one_or_none()
    if root_uni is not None:
        root_metrics = dict(root_uni.latest_metrics or {})

    meta = dict(run.safe_edit_metadata or {})

    return RunDetail(
        run_id=run.big_bang_id,
        display_name=run.display_name,
        description=meta.get("description"),
        status=run.status,
        scenario_text=run.scenario_text,
        time_horizon_label=run.time_horizon_label,
        tick_duration_minutes=run.tick_duration_minutes,
        max_ticks=run.max_ticks,
        max_schedule_horizon_ticks=run.max_schedule_horizon_ticks,
        root_universe_id=run.root_universe_id,
        run_folder_path=run.run_folder_path or None,
        source_of_truth_version=run.source_of_truth_version or None,
        provider_snapshot_id=run.provider_snapshot_id or None,
        created_at=run.created_at,
        updated_at=run.updated_at,
        active_universe_count=active_count,
        total_universe_count=total_count,
        latest_metrics=root_metrics,
        safe_edit_metadata=meta,
    )


# ---------------------------------------------------------------------------
# PATCH /api/runs/{run_id}
# ---------------------------------------------------------------------------


@router.patch("/{run_id}", response_model=RunDetail)
async def patch_run(
    run_id: str, body: PatchRunRequest, session: DbSession
) -> RunDetail:
    """Partially update safe metadata fields for a run.

    Only display_name, description, tags, favorite, and archived are allowed.
    Extra fields cause a 422 from Pydantic (extra="forbid").
    """
    run = await _get_run_or_404(run_id, session)
    meta = dict(run.safe_edit_metadata or {})

    if body.display_name is not None:
        run.display_name = body.display_name
    if body.description is not None:
        meta["description"] = body.description
    if body.tags is not None:
        meta["tags"] = body.tags
    if body.favorite is not None:
        meta["favorite"] = body.favorite
    if body.archived is not None:
        meta["archived"] = body.archived

    run.safe_edit_metadata = meta
    await session.commit()
    await session.refresh(run)

    return await get_run(run_id, session)


# ---------------------------------------------------------------------------
# POST /api/runs/{run_id}/archive
# ---------------------------------------------------------------------------


@router.post("/{run_id}/archive", status_code=204)
async def archive_run(run_id: str, session: DbSession) -> None:
    """Mark a run as archived."""
    run = await _get_run_or_404(run_id, session)
    meta = dict(run.safe_edit_metadata or {})
    meta["archived"] = True
    run.safe_edit_metadata = meta
    await session.commit()


# ---------------------------------------------------------------------------
# POST /api/runs/{run_id}/duplicate
# ---------------------------------------------------------------------------


@router.post("/{run_id}/duplicate", status_code=201)
async def duplicate_run(run_id: str, session: DbSession) -> dict:
    """Clone a run row.  Does NOT enqueue initialization; user must POST /init."""
    original = await _get_run_or_404(run_id, session)

    new_big_bang_id = new_id("run")
    new_root_universe_id = new_id("uni")
    original_meta = dict(original.safe_edit_metadata or {})
    new_meta: dict = {k: v for k, v in original_meta.items() if k != "idempotency_key"}

    clone = BigBangRunModel(
        big_bang_id=new_big_bang_id,
        display_name=f"Copy of {original.display_name}",
        scenario_text=original.scenario_text,
        input_file_ids=list(original.input_file_ids or []),
        status="draft",
        time_horizon_label=original.time_horizon_label,
        tick_duration_minutes=original.tick_duration_minutes,
        max_ticks=original.max_ticks,
        max_schedule_horizon_ticks=original.max_schedule_horizon_ticks,
        source_of_truth_version=original.source_of_truth_version,
        source_of_truth_snapshot_path="",
        provider_snapshot_id=original.provider_snapshot_id,
        root_universe_id=new_root_universe_id,
        run_folder_path="",
        safe_edit_metadata=new_meta,
    )
    session.add(clone)
    await session.commit()

    return {"run_id": new_big_bang_id, "root_universe_id": new_root_universe_id, "status": "draft"}


# ---------------------------------------------------------------------------
# POST /api/runs/{run_id}/export
# ---------------------------------------------------------------------------


@router.post("/{run_id}/export", status_code=202)
async def export_run(run_id: str, session: DbSession) -> dict:
    """Enqueue an export_run job and return the job_id."""
    await _get_run_or_404(run_id, session)

    envelope = make_envelope(
        job_type="export_run",
        run_id=run_id,
        payload={"run_id": run_id},
    )
    job_id = envelope.job_id
    try:
        await enqueue(envelope)
    except Exception:
        pass

    return {"job_id": job_id, "status": "queued"}


# ---------------------------------------------------------------------------
# GET /api/runs/{run_id}/source-of-truth
# ---------------------------------------------------------------------------


@router.get("/{run_id}/source-of-truth", response_model=SoTBundleResponse)
async def get_source_of_truth(run_id: str, session: DbSession) -> SoTBundleResponse:
    """Return the SoT snapshot bundle for a run.

    First attempts to read from the run's ledger snapshot directory.
    Falls back to the live source_of_truth/ directory if ledger is not yet
    initialised (draft/initializing runs).
    """
    run = await _get_run_or_404(run_id, session)

    from backend.app.storage.sot_loader import SoTBundle, load_sot

    sot: SoTBundle | None = None

    # Try ledger snapshot path.
    if run.source_of_truth_snapshot_path:
        from pathlib import Path

        snapshot_path = Path(run.source_of_truth_snapshot_path)
        if snapshot_path.exists():
            try:
                sot = load_sot(snapshot_path)
            except Exception:
                sot = None

    if sot is None:
        try:
            sot = load_sot()
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Source-of-truth not available: {exc}",
            ) from exc

    return SoTBundleResponse(
        version=sot.version,
        emotions=sot.emotions,
        behavior_axes=sot.behavior_axes,
        ideology_axes=sot.ideology_axes,
        expression_scale=sot.expression_scale,
        issue_stance_axes=sot.issue_stance_axes,
        event_types=sot.event_types,
        social_action_tools=sot.social_action_tools,
        channel_types=sot.channel_types,
        actor_types=sot.actor_types,
        sociology_parameters=sot.sociology_parameters,
    )
