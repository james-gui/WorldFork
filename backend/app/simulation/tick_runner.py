"""End-to-end tick runner — PRD §11.1 verbatim ordering.

This is the central orchestration point of the WorldFork simulation. The
``run_tick`` coroutine implements the full §11.1 loop for a single
``(universe_id, tick)`` pair:

1. Idempotency guard via Redis SETNX (``scheduler.already_running``).
2. Load Universe row; assert ``status == "active"``.
3. Begin the ledger tick — write ``clock.json``.
4. Snapshot the universe state pre-tick → ``universe_state_before.json``.
5. Resolve due events.
6. Synthesize news + channel posts.
7. Compute per-cohort visible feeds (Redis-cached).
8. Select active cohorts/heroes via the §11.2 activity score.
9. Build prompt packets per active actor.
10. Dispatch agent deliberations (Celery chord OR local asyncio.gather).
11. Apply parsed decisions: social actions, event tools, private state,
    sociology transitions, split/merge, graphs, memory writes (P2),
    metrics, god review, branch dispatch.
12. Seal the tick.
13. Publish WS events; auto-enqueue next tick if active and below max.
14. Return summary dict.

The dispatcher is pluggable: in production it goes through Celery, in tests
it falls back to ``asyncio.gather`` so no broker is required.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.app.api import websockets_publishers as wsp
from backend.app.branching.branch_policy import (
    MultiverseSnapshot,
    evaluate_branch_policy,
)
from backend.app.branching.god_agent import GodReviewInput, god_review
from backend.app.core.clock import now_utc
from backend.app.core.ids import new_id
from backend.app.providers import call_with_policy
from backend.app.providers.rate_limits import ProviderRateLimiter
from backend.app.providers.routing import RoutingTable
from backend.app.schemas.actors import CohortState, HeroState, PopulationArchetype
from backend.app.schemas.branching import BranchPolicy
from backend.app.schemas.common import Clock
from backend.app.schemas.events import Event
from backend.app.schemas.llm import (
    GodReviewOutput,
    PromptPacket,
)
from backend.app.schemas.posts import SocialPost
from backend.app.schemas.sociology import SociologyParams
from backend.app.simulation.active_selection import (
    estimate_event_salience,
    estimate_social_pressure,
    select_active_cohorts,
    select_active_heroes,
)
from backend.app.simulation.metrics import compute_universe_metrics
from backend.app.simulation.lifecycle import (
    apply_universe_completion_decision,
    prepare_results_job_if_run_terminal,
)
from backend.app.simulation.prompt_builder import PromptBuilder
from backend.app.simulation.tool_parser import ToolParseError, ToolParser
from backend.app.simulation.validators import ValidationContext
from backend.app.sociology.parameters import load_sociology_params
from backend.app.sociology.split_merge import (
    audit_population_conservation,
    commit_split,
)
from backend.app.sociology.transitions import run_all_transitions
from backend.app.storage import artifacts as artwriters
from backend.app.storage.ledger import ImmutabilityError, Ledger
from backend.app.storage.sot_loader import SoTBundle, load_sot
from backend.app.workers import scheduler

if TYPE_CHECKING:
    from backend.app.memory.base import MemoryProvider

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------


@dataclass
class TickContext:
    """Per-task context carried through the §11.1 loop."""

    run_id: str
    universe_id: str
    tick: int
    attempt_number: int = 1
    sot: SoTBundle | None = None
    params: SociologyParams | None = None


@dataclass
class _DispatchedDecision:
    """Internal: one parsed decision plus its actor metadata."""

    actor_id: str
    actor_kind: str  # "cohort" | "hero"
    parsed: dict
    raw_call_id: str | None = None


# Type alias for the deliberation dispatcher injection point. See
# :func:`_dispatch_deliberations`.
DispatcherFn = Callable[
    [list[tuple[str, str, PromptPacket]]],
    Awaitable[list[_DispatchedDecision]],
]


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


async def run_tick(
    ctx: TickContext,
    *,
    session: AsyncSession,
    ledger: Ledger,
    routing: RoutingTable,
    limiter: ProviderRateLimiter,
    memory: MemoryProvider | None = None,
    dispatcher: DispatcherFn | None = None,
) -> dict:
    """Run the §11.1 tick loop end-to-end for one universe at one tick.

    Returns a summary dict suitable for the Celery result backend (and tests).
    Raises only on truly unrecoverable failures — all per-step soft failures
    are logged and swallowed so a single bad cohort can't crash the loop.

    Parameters
    ----------
    ctx
        :class:`TickContext` carrying run/universe/tick + optional pre-loaded
        SoT bundle and sociology parameters.
    session
        An open async SQLAlchemy session — caller owns lifecycle.
    ledger
        The ledger for the run.  Already opened via :meth:`Ledger.open` or
        :meth:`Ledger.begin_run`.
    routing
        The routing table to use for LLM calls.
    limiter
        The provider rate limiter (Redis token bucket / concurrency gate).
    memory
        Optional :class:`MemoryProvider`.  Memory writes are fire-and-forget.
    dispatcher
        Optional override for the deliberation dispatcher.  Defaults to
        :func:`_dispatch_deliberations_local`.
    """
    # Lazy imports for ORM models — keeps import-time graph slim.
    from backend.app.models.cohorts import (
        CohortStateModel,
        PopulationArchetypeModel,
    )
    from backend.app.models.heroes import HeroArchetypeModel, HeroStateModel
    from backend.app.models.posts import SocialPostModel
    from backend.app.models.runs import BigBangRunModel
    from backend.app.models.universes import UniverseModel

    summary: dict[str, Any] = {
        "run_id": ctx.run_id,
        "universe_id": ctx.universe_id,
        "tick": ctx.tick,
        "attempt_number": ctx.attempt_number,
        "status": "started",
    }

    # ---- 1. Idempotency key + SETNX guard -----------------------------
    idem_key = (
        f"sim:{ctx.run_id}:{ctx.universe_id}:t{ctx.tick}:a{ctx.attempt_number}"
    )
    summary["idempotency_key"] = idem_key

    try:
        already = await scheduler.already_running(idem_key)
    except Exception as exc:  # pragma: no cover — Redis missing in some tests
        _log.warning("scheduler.already_running raised %s; proceeding", exc)
        already = False

    if already:
        try:
            cached = await scheduler.get_done_result(idem_key)
        except Exception:
            cached = None
        if cached is None:
            raise RuntimeError(
                f"tick idempotency key {idem_key!r} is already claimed but has no done marker"
            )
        _log.info(
            "tick %s already done (cached=%r); short-circuit",
            idem_key, cached,
        )
        return {**summary, "status": "already_done", "cached": cached}

    # ---- 2. Load Universe + assert active -----------------------------
    universe: UniverseModel | None = await session.get(UniverseModel, ctx.universe_id)
    if universe is None:
        return {**summary, "status": "universe_missing"}
    if universe.status not in ("active", "candidate"):
        _log.info(
            "tick skipped: universe %s status=%s (not active)",
            ctx.universe_id, universe.status,
        )
        return {**summary, "status": f"universe_{universe.status}"}

    # ---- Load BigBang run for max_ticks lookup ------------------------
    run_row = await session.get(BigBangRunModel, ctx.run_id)
    max_ticks: int = int(getattr(run_row, "max_ticks", 30) or 30) if run_row else 30

    # ---- Load SoT + sociology params if not provided ------------------
    sot = ctx.sot
    if sot is None:
        try:
            sot = load_sot()
        except Exception as exc:  # pragma: no cover — sot present in tests
            _log.error("load_sot() failed: %s", exc)
            return {**summary, "status": "sot_unavailable", "error": str(exc)}
    ctx.sot = sot

    params = ctx.params or load_sociology_params(sot)
    ctx.params = params

    # ---- 3. ledger.begin_tick + persist clock.json --------------------
    try:
        ledger.begin_tick(ctx.universe_id, ctx.tick)
    except Exception as exc:
        _log.warning("ledger.begin_tick failed: %s", exc)

    clock = Clock(
        current_tick=ctx.tick,
        tick_duration_minutes=int(getattr(run_row, "tick_duration_minutes", 60) or 60)
        if run_row else 60,
        elapsed_minutes=ctx.tick * (
            int(getattr(run_row, "tick_duration_minutes", 60) or 60) if run_row else 60
        ),
        previous_tick_minutes=None,
        max_schedule_horizon_ticks=int(
            getattr(run_row, "max_schedule_horizon_ticks", 5) or 5
        ) if run_row else 5,
    )

    # ---- 4. Snapshot universe state BEFORE tick -----------------------
    cohort_rows_q = select(CohortStateModel).where(
        CohortStateModel.universe_id == ctx.universe_id,
        CohortStateModel.is_active.is_(True),
    )
    cohort_rows = list((await session.execute(cohort_rows_q)).scalars().all())

    # Keep only the latest tick row per cohort_id ≤ current tick.
    latest_cohort_by_id: dict[str, Any] = {}
    for r in cohort_rows:
        if r.tick > ctx.tick:
            continue
        ex = latest_cohort_by_id.get(r.cohort_id)
        if ex is None or r.tick > ex.tick:
            latest_cohort_by_id[r.cohort_id] = r
    cohort_rows = list(latest_cohort_by_id.values())
    cohort_states: list[CohortState] = [r.to_schema() for r in cohort_rows]

    hero_rows_q = select(HeroStateModel).where(
        HeroStateModel.universe_id == ctx.universe_id,
    )
    hero_rows_all = list((await session.execute(hero_rows_q)).scalars().all())
    latest_hero_by_id: dict[str, Any] = {}
    for r in hero_rows_all:
        if r.tick > ctx.tick:
            continue
        ex = latest_hero_by_id.get(r.hero_id)
        if ex is None or r.tick > ex.tick:
            latest_hero_by_id[r.hero_id] = r
    hero_rows = list(latest_hero_by_id.values())
    hero_states: list[HeroState] = [r.to_schema() for r in hero_rows]

    # Pre-fetch archetype rows so we don't N+1 in prompt builds.
    archetype_ids = {c.archetype_id for c in cohort_states}
    if archetype_ids:
        arch_q = select(PopulationArchetypeModel).where(
            PopulationArchetypeModel.archetype_id.in_(list(archetype_ids))
        )
        arch_rows = (await session.execute(arch_q)).scalars().all()
        archetypes_by_id: dict[str, PopulationArchetype] = {
            r.archetype_id: r.to_schema() for r in arch_rows
        }
    else:
        archetypes_by_id = {}

    hero_arch_q = select(HeroArchetypeModel)
    hero_arch_rows = (await session.execute(hero_arch_q)).scalars().all()
    hero_archetypes_by_id = {r.hero_id: r.to_schema() for r in hero_arch_rows}

    state_before = {
        "tick": ctx.tick,
        "universe_id": ctx.universe_id,
        "cohorts": [c.model_dump(mode="json") for c in cohort_states],
        "heroes": [h.model_dump(mode="json") for h in hero_states],
        "cohort_count": len(cohort_states),
        "hero_count": len(hero_states),
        "metrics_prev": dict(universe.latest_metrics or {}),
    }
    try:
        artwriters.write_tick_state_before(
            ledger, ctx.universe_id, ctx.tick, state_before
        )
    except (ImmutabilityError, Exception) as exc:
        _log.debug("state_before write skipped: %s", exc)

    # ---- 5. Resolve due events ----------------------------------------
    resolved_events: list[Event] = await _resolve_due_events(
        session=session,
        ledger=ledger,
        universe_id=ctx.universe_id,
        tick=ctx.tick,
    )
    summary["resolved_events"] = len(resolved_events)

    # ---- 6. Synthesize news + channel posts ---------------------------
    news_posts = _synthesize_news_posts(resolved_events, universe_id=ctx.universe_id, tick=ctx.tick)
    if news_posts:
        for p in news_posts:
            session.add(SocialPostModel.from_schema(p))
        await session.flush()
        try:
            for p in news_posts:
                ledger.append_jsonl(
                    f"universes/{ctx.universe_id}/ticks/tick_{ctx.tick:03d}/social_posts/news.jsonl",
                    p.model_dump(mode="json"),
                )
        except Exception as exc:
            _log.debug("news jsonl write skipped: %s", exc)

    # ---- 7. Compute visible feeds (Redis-cached) ----------------------
    visible_feeds = await _compute_visible_feeds(
        cohort_states=cohort_states,
        archetypes_by_id=archetypes_by_id,
        recent_posts=news_posts,
        universe_id=ctx.universe_id,
        tick=ctx.tick,
    )

    # ---- 8. Select active cohorts/heroes ------------------------------
    salience_lookup: dict[str, float] = {}
    for c in cohort_states:
        sal = 0.0
        for ev in resolved_events:
            if c.cohort_id in (ev.target_audience or []) or c.archetype_id in (
                ev.target_audience or []
            ):
                sal += estimate_event_salience(ev, current_tick=ctx.tick)
        # Add social pressure from visible feed.
        sal += 0.5 * estimate_social_pressure(
            c, visible_feeds.get(c.cohort_id, [])
        )
        salience_lookup[c.cohort_id] = min(2.0, sal)

    hero_salience: dict[str, float] = {}
    for h in hero_states:
        sal = 0.0
        for ev in resolved_events:
            if h.hero_id in (ev.participants or []) or h.hero_id in (
                ev.target_audience or []
            ):
                sal += estimate_event_salience(ev, current_tick=ctx.tick)
        hero_salience[h.hero_id] = min(2.0, sal)

    active_cohorts = select_active_cohorts(
        cohort_states, salience_lookup=salience_lookup, threshold=0.5
    )
    active_heroes = select_active_heroes(
        hero_states, salience_lookup=hero_salience, threshold=0.4
    )
    summary["active_cohorts"] = len(active_cohorts)
    summary["active_heroes"] = len(active_heroes)

    # ---- 9. Build prompt packets --------------------------------------
    builder = PromptBuilder(sot)
    packets: list[tuple[str, str, PromptPacket]] = []  # (actor_id, kind, packet)

    for c in active_cohorts:
        archetype = archetypes_by_id.get(c.archetype_id)
        if archetype is None:
            _log.debug("skipping cohort %s — archetype missing", c.cohort_id)
            continue
        try:
            packet = builder.build_cohort_packet(
                cohort=c,
                archetype=archetype,
                clock=clock,
                visible_feed=visible_feeds.get(c.cohort_id, []),
                visible_events=resolved_events,
                own_queued_events=[],
                own_recent_actions=[],
                retrieved_memory=None,
            )
        except Exception as exc:  # noqa: BLE001
            _log.warning("packet build failed for cohort %s: %s", c.cohort_id, exc)
            continue
        packets.append((c.cohort_id, "cohort", packet))
        try:
            artwriters.write_visible_packet(
                ledger, ctx.universe_id, ctx.tick, c.cohort_id,
                packet.model_dump(mode="json"),
            )
        except Exception:
            pass

    for h in active_heroes:
        archetype = hero_archetypes_by_id.get(h.hero_id)
        if archetype is None:
            _log.debug("skipping hero %s — archetype missing", h.hero_id)
            continue
        try:
            packet = builder.build_hero_packet(
                hero=h,
                archetype=archetype,
                clock=clock,
                visible_feed=[],
                visible_events=resolved_events,
                own_queued_events=[],
                own_recent_actions=[],
                retrieved_memory=None,
            )
        except Exception as exc:  # noqa: BLE001
            _log.warning("packet build failed for hero %s: %s", h.hero_id, exc)
            continue
        packets.append((h.hero_id, "hero", packet))
        try:
            artwriters.write_visible_packet(
                ledger, ctx.universe_id, ctx.tick, h.hero_id,
                packet.model_dump(mode="json"),
            )
        except Exception:
            pass

    # ---- 10. Dispatch deliberations -----------------------------------
    if dispatcher is None:
        dispatcher = _make_local_dispatcher(
            run_id=ctx.run_id,
            universe_id=ctx.universe_id,
            tick=ctx.tick,
            routing=routing,
            limiter=limiter,
            ledger=ledger,
        )
    try:
        decisions: list[_DispatchedDecision] = await dispatcher(packets)
    except Exception as exc:  # noqa: BLE001
        _log.exception("deliberation dispatch failed: %s", exc)
        decisions = []
    summary["decisions"] = len(decisions)

    # ---- 11–13. Apply tick results (the heavy bits) -------------------
    apply_summary = await _apply_tick_results(
        decisions=decisions,
        ctx=ctx,
        session=session,
        ledger=ledger,
        sot=sot,
        params=params,
        routing=routing,
        limiter=limiter,
        memory=memory,
        cohort_rows=cohort_rows,
        cohort_states=cohort_states,
        hero_rows=hero_rows,
        hero_states=hero_states,
        archetypes_by_id=archetypes_by_id,
        resolved_events=resolved_events,
        all_posts=news_posts,
        universe=universe,
    )
    summary["apply_summary"] = apply_summary

    # ---- 14. Seal tick + write state_after ----------------------------
    state_after = await _build_state_after(
        session=session,
        universe_id=ctx.universe_id,
        tick=ctx.tick,
        metrics=apply_summary.get("metrics", {}),
    )
    try:
        artwriters.write_tick_state_after(
            ledger, ctx.universe_id, ctx.tick, state_after
        )
    except (ImmutabilityError, Exception) as exc:
        _log.debug("state_after write skipped: %s", exc)
    try:
        ledger.seal_tick(ctx.universe_id, ctx.tick)
    except Exception as exc:
        _log.debug("seal_tick failed: %s", exc)

    # ---- 15. Publish WS events ----------------------------------------
    metrics = apply_summary.get("metrics", {})
    try:
        await wsp.publish_tick_completed(
            run_id=ctx.run_id, universe_id=ctx.universe_id,
            tick=ctx.tick, metrics=metrics,
        )
        await wsp.publish_metrics_updated(
            run_id=ctx.run_id, universe_id=ctx.universe_id,
            tick=ctx.tick, metrics=metrics,
        )
    except Exception as exc:
        _log.debug("ws publish failed: %s", exc)

    # ---- 16. Update universe.current_tick + lifecycle + auto-enqueue next
    try:
        await session.refresh(universe)
    except Exception:
        pass
    universe.current_tick = ctx.tick
    universe.latest_metrics = dict(metrics) if metrics else (universe.latest_metrics or {})
    try:
        flag_modified(universe, "latest_metrics")
    except Exception:
        pass
    completion_summary = await apply_universe_completion_decision(
        session=session,
        run=run_row,
        universe=universe,
        tick=ctx.tick,
        god_decision=apply_summary.get("god_decision"),
        metrics=dict(metrics) if metrics else {},
    )
    summary["completion_summary"] = completion_summary
    results_envelope = await prepare_results_job_if_run_terminal(
        session=session,
        run_id=ctx.run_id,
        reason=completion_summary.get("reason", "tick_lifecycle"),
    )
    await session.commit()

    next_tick_enqueued = False
    if universe.status == "active" and ctx.tick < max_ticks:
        try:
            envelope = scheduler.make_envelope(
                job_type="simulate_universe_tick",
                run_id=ctx.run_id,
                universe_id=ctx.universe_id,
                tick=ctx.tick + 1,
                payload={
                    "run_id": ctx.run_id,
                    "universe_id": ctx.universe_id,
                    "tick": ctx.tick + 1,
                },
            )
            await scheduler.enqueue(envelope)
            next_tick_enqueued = True
        except Exception as exc:
            _log.debug("auto-enqueue next tick skipped: %s", exc)

    summary["next_tick_enqueued"] = next_tick_enqueued
    results_job_enqueued = False
    if results_envelope is not None:
        try:
            await scheduler.enqueue(results_envelope)
            results_job_enqueued = True
            summary["results_job_id"] = results_envelope.job_id
        except Exception as exc:
            _log.debug("results aggregation enqueue skipped: %s", exc)
    summary["results_job_enqueued"] = results_job_enqueued

    # ---- 17. Mark idempotency done ------------------------------------
    try:
        await scheduler.mark_done(idem_key, result_path=str(ledger.run_folder))
    except Exception as exc:
        _log.debug("scheduler.mark_done failed: %s", exc)

    summary["status"] = "completed"
    return summary


# ---------------------------------------------------------------------------
# Step 5: resolve due events
# ---------------------------------------------------------------------------


async def _resolve_due_events(
    *,
    session: AsyncSession,
    ledger: Ledger,
    universe_id: str,
    tick: int,
) -> list[Event]:
    """Mark scheduled events whose ``scheduled_tick == tick`` as ``active``.

    Computes a heuristic ``actual_effects`` blob (mirrors ``expected_effects``
    by default) and persists ``events/resolved.jsonl``.  Returns the list of
    resolved :class:`Event` schemas for downstream salience computation.
    """
    from backend.app.models.events import EventModel

    q = select(EventModel).where(
        EventModel.universe_id == universe_id,
        EventModel.scheduled_tick == tick,
        EventModel.status == "scheduled",
    )
    rows = list((await session.execute(q)).scalars().all())

    resolved: list[Event] = []
    for row in rows:
        row.status = "active"
        # Heuristic actual_effects: copy expected, scale by risk_level.
        expected = dict(row.expected_effects or {})
        risk = float(row.risk_level)
        actual = {k: float(v) * (0.5 + 0.5 * risk) for k, v in expected.items()
                  if isinstance(v, (int, float))}
        for k, v in expected.items():
            if k not in actual:
                actual[k] = v
        row.actual_effects = actual
        try:
            flag_modified(row, "actual_effects")
        except Exception:
            pass
        resolved.append(row.to_schema())

    if rows:
        await session.flush()

    if resolved:
        try:
            for e in resolved:
                ledger.append_jsonl(
                    f"universes/{universe_id}/ticks/tick_{tick:03d}/events/resolved.jsonl",
                    e.model_dump(mode="json"),
                )
        except Exception as exc:
            _log.debug("events/resolved.jsonl write skipped: %s", exc)

    return resolved


# ---------------------------------------------------------------------------
# Step 6: synthesize news posts
# ---------------------------------------------------------------------------


def _synthesize_news_posts(
    events: list[Event], *, universe_id: str, tick: int
) -> list[SocialPost]:
    """Produce 0–N synthetic media posts mirroring resolved events.

    Up to 3 events get one ``mainstream_news`` post each; if any event is a
    high-risk one, also synthesize a ``local_press`` post.
    """
    if not events:
        return []
    out: list[SocialPost] = []
    for ev in events[:3]:
        out.append(
            SocialPost(
                post_id=new_id("post"),
                universe_id=universe_id,
                platform="mainstream_news",
                tick_created=tick,
                author_actor_id="channel_mainstream_news",
                author_avatar_id=None,
                content=f"[news] {ev.title}: {ev.description[:160]}",
                stance_signal={},
                emotion_signal={},
                credibility_signal=0.7,
                visibility_scope="public",
                reach_score=min(1.0, 0.3 + 0.5 * ev.risk_level),
                hot_score=ev.risk_level,
                reactions={},
                repost_count=0,
                comment_count=0,
                upvote_power_total=0.0,
                downvote_power_total=0.0,
            )
        )
        if ev.risk_level >= 0.5:
            out.append(
                SocialPost(
                    post_id=new_id("post"),
                    universe_id=universe_id,
                    platform="local_press",
                    tick_created=tick,
                    author_actor_id="channel_local_press",
                    author_avatar_id=None,
                    content=f"[local press] {ev.title}",
                    stance_signal={},
                    emotion_signal={},
                    credibility_signal=0.55,
                    visibility_scope="public",
                    reach_score=min(1.0, 0.2 + 0.4 * ev.risk_level),
                    hot_score=ev.risk_level * 0.8,
                    reactions={},
                    repost_count=0,
                    comment_count=0,
                    upvote_power_total=0.0,
                    downvote_power_total=0.0,
                )
            )
    return out


# ---------------------------------------------------------------------------
# Step 7: compute visible feeds
# ---------------------------------------------------------------------------


async def _compute_visible_feeds(
    *,
    cohort_states: list[CohortState],
    archetypes_by_id: dict[str, PopulationArchetype],
    recent_posts: list[SocialPost],
    universe_id: str,
    tick: int,
) -> dict[str, list[SocialPost]]:
    """Slice posts per cohort by ``preferred_channels``; cache in Redis."""
    by_cohort: dict[str, list[SocialPost]] = {}
    for c in cohort_states:
        archetype = archetypes_by_id.get(c.archetype_id)
        if archetype is None:
            by_cohort[c.cohort_id] = list(recent_posts)
            continue
        prefs = set(archetype.preferred_channels or [])
        if not prefs:
            by_cohort[c.cohort_id] = list(recent_posts)
            continue
        by_cohort[c.cohort_id] = [p for p in recent_posts if p.platform in prefs]

    # Best-effort Redis cache.
    try:
        import orjson

        from backend.app.core.redis_client import get_redis_client

        redis = get_redis_client()
        for cid, posts in by_cohort.items():
            key = f"feed:{universe_id}:{tick}:{cid}"
            payload = [p.model_dump(mode="json") for p in posts]
            await redis.set(key, orjson.dumps(payload), ex=3600)
    except Exception as exc:
        _log.debug("redis feed cache skipped: %s", exc)

    return by_cohort


# ---------------------------------------------------------------------------
# Step 10: dispatcher
# ---------------------------------------------------------------------------


def _make_local_dispatcher(
    *,
    run_id: str,
    universe_id: str,
    tick: int,
    routing: RoutingTable,
    limiter: ProviderRateLimiter,
    ledger: Ledger,
) -> DispatcherFn:
    """Build a local asyncio.gather-based deliberation dispatcher.

    Used in test mode and when no Celery broker is reachable.
    """

    async def _dispatch_deliberations_local(
        packets: list[tuple[str, str, PromptPacket]],
    ) -> list[_DispatchedDecision]:
        if not packets:
            return []

        async def _one(actor_id: str, kind: str, packet: PromptPacket) -> _DispatchedDecision | None:
            try:
                result = await call_with_policy(
                    job_type="agent_deliberation_batch",
                    prompt=packet,
                    routing=routing,
                    limiter=limiter,
                    ledger=ledger,
                    run_id=run_id,
                    universe_id=universe_id,
                    tick=tick,
                )
            except Exception as exc:  # noqa: BLE001
                _log.warning(
                    "deliberation call failed for %s/%s: %s", kind, actor_id, exc,
                )
                return None
            return _DispatchedDecision(
                actor_id=actor_id,
                actor_kind=kind,
                parsed=dict(result.parsed_json or {}),
                raw_call_id=result.call_id,
            )

        results = await asyncio.gather(
            *[_one(aid, k, p) for (aid, k, p) in packets],
            return_exceptions=False,
        )
        return [r for r in results if r is not None]

    return _dispatch_deliberations_local


async def _dispatch_deliberations(
    packets: list[tuple[str, str, PromptPacket]],
    *,
    run_id: str,
    universe_id: str,
    tick: int,
    routing: RoutingTable,
    limiter: ProviderRateLimiter,
    ledger: Ledger | None = None,
    use_celery: bool = False,
) -> list[_DispatchedDecision]:
    """Public dispatcher entry: chooses Celery chord or asyncio.gather.

    For now Celery dispatch falls back to local because the chord callback
    depends on running workers + a result backend.  Tests use the local path.
    """
    if not use_celery:
        if ledger is None:
            raise ValueError("ledger required for local dispatcher")
        local = _make_local_dispatcher(
            run_id=run_id, universe_id=universe_id, tick=tick,
            routing=routing, limiter=limiter, ledger=ledger,
        )
        return await local(packets)
    # Celery path is implemented in workers/jobs.py via chord(group(...)).
    raise NotImplementedError("Celery dispatch path lives in workers.jobs")


# ---------------------------------------------------------------------------
# Step 11–13: apply tick results
# ---------------------------------------------------------------------------


async def _apply_tick_results(
    *,
    decisions: list[_DispatchedDecision],
    ctx: TickContext,
    session: AsyncSession,
    ledger: Ledger,
    sot: SoTBundle,
    params: SociologyParams,
    routing: RoutingTable,
    limiter: ProviderRateLimiter,
    memory: MemoryProvider | None,
    cohort_rows: list[Any],
    cohort_states: list[CohortState],
    hero_rows: list[Any],
    hero_states: list[HeroState],
    archetypes_by_id: dict[str, PopulationArchetype],
    resolved_events: list[Event],
    all_posts: list[SocialPost],
    universe: Any,
) -> dict:
    """Parse, validate, and apply the parsed agent decisions in §11.1 order.

    Returns a summary dict aggregating counts of each side effect and the
    final per-tick metrics blob.
    """
    from backend.app.models.cohorts import CohortStateModel
    from backend.app.models.events import EventModel
    from backend.app.models.posts import SocialPostModel

    parser = ToolParser(sot)
    parsed_decisions_serialised: list[dict] = []

    cohort_state_by_id = {c.cohort_id: c for c in cohort_states}
    hero_state_by_id = {h.hero_id: h for h in hero_states}

    new_posts: list[SocialPost] = []
    new_events: list[Event] = []
    self_ratings: dict[str, dict] = {}
    split_proposals_per_cohort: dict[str, list[dict]] = {}

    for d in decisions:
        actor_kind = d.actor_kind
        try:
            if actor_kind == "cohort":
                decision = parser.parse_cohort_output(d.parsed)  # noqa: F841
            elif actor_kind == "hero":
                decision = parser.parse_hero_output(d.parsed)  # noqa: F841
            else:
                continue
        except ToolParseError as exc:
            _log.warning(
                "decision parse failed for %s/%s: %s",
                actor_kind, d.actor_id, exc,
            )
            continue

        # Validate + sanitize tool calls against SoT registry.
        actor_obj = (
            cohort_state_by_id.get(d.actor_id)
            if actor_kind == "cohort"
            else hero_state_by_id.get(d.actor_id)
        )
        allowed = (
            set(actor_obj.allowed_tools) if isinstance(actor_obj, CohortState) and actor_obj.allowed_tools
            else set()
        )
        vctx = ValidationContext(sot, actor_obj, allowed)
        sanitized = vctx.sanitize_decision(d.parsed)

        parsed_decisions_serialised.append({
            "actor_id": d.actor_id,
            "actor_kind": actor_kind,
            "decision": sanitized,
            "raw_call_id": d.raw_call_id,
        })

        # ---- apply_social_actions ------------------------------------
        for entry in (sanitized.get("social_actions") or []):
            tool_id = entry.get("tool_id")
            args = entry.get("args") or {}
            if tool_id == "create_social_post":
                content = str(args.get("content") or "")[:2000]
                if not content:
                    continue
                visibility_scope = str(args.get("visibility_scope") or "public").lower()
                visibility_scope = {
                    "private_group": "private",
                    "group": "cohort",
                    "cohort_private": "cohort",
                    "followers_only": "followers",
                    "friends": "followers",
                    "global": "public",
                }.get(visibility_scope, visibility_scope)
                if visibility_scope not in {"public", "followers", "private", "cohort"}:
                    visibility_scope = "public"

                post = SocialPost(
                    post_id=new_id("post"),
                    universe_id=ctx.universe_id,
                    platform=str(args.get("platform") or "twitter"),
                    tick_created=ctx.tick,
                    author_actor_id=d.actor_id,
                    author_avatar_id=None,
                    content=content,
                    stance_signal=dict(args.get("stance_signal") or {}),
                    emotion_signal=dict(args.get("emotion_signal") or {}),
                    credibility_signal=max(0.0, min(1.0, float(args.get("credibility_signal", 0.5)))),
                    visibility_scope=visibility_scope,
                    reach_score=max(0.0, min(1.0, float(args.get("reach_score", 0.3)))),
                    hot_score=max(0.0, float(args.get("hot_score", 0.0))),
                    reactions={},
                    repost_count=0,
                    comment_count=0,
                    upvote_power_total=0.0,
                    downvote_power_total=0.0,
                )
                new_posts.append(post)

        # ---- apply_event_tools ---------------------------------------
        for entry in (sanitized.get("event_actions") or []):
            tool_id = entry.get("tool_id")
            args = entry.get("args") or {}
            if tool_id == "queue_event":
                try:
                    sched = max(int(args.get("scheduled_tick", ctx.tick + 1)), ctx.tick + 1)
                    ev = Event(
                        event_id=new_id("evt"),
                        universe_id=ctx.universe_id,
                        created_tick=ctx.tick,
                        scheduled_tick=sched,
                        duration_ticks=int(args.get("duration_ticks") or 1),
                        event_type=str(args.get("event_type") or "background_event"),
                        title=str(args.get("title") or "queued event")[:160],
                        description=str(args.get("description") or "")[:1000],
                        created_by_actor_id=d.actor_id,
                        participants=list(args.get("participants") or []),
                        target_audience=list(args.get("target_audience") or []),
                        visibility=str(args.get("visibility") or "public"),
                        preconditions=[],
                        expected_effects=dict(args.get("expected_effects") or {}),
                        actual_effects=None,
                        risk_level=float(args.get("risk_level", 0.2)),
                        status="scheduled",
                        parent_event_id=None,
                        source_llm_call_id=d.raw_call_id,
                    )
                    new_events.append(ev)
                except Exception as exc:  # noqa: BLE001
                    _log.debug("event queue parse failed: %s", exc)

        # ---- update_private_states (collect; persist later) ----------
        ratings = sanitized.get("self_ratings") or {}
        if ratings:
            self_ratings[d.actor_id] = dict(ratings)

        # ---- collect split proposals (cohort only) -------------------
        if actor_kind == "cohort":
            sps = sanitized.get("split_merge_proposals") or []
            if sps:
                split_proposals_per_cohort[d.actor_id] = list(sps)

    # Persist new posts.
    for p in new_posts:
        session.add(SocialPostModel.from_schema(p))
    if new_posts:
        await session.flush()
        try:
            for p in new_posts:
                ledger.append_jsonl(
                    f"universes/{ctx.universe_id}/ticks/tick_{ctx.tick:03d}/social_posts/posts.jsonl",
                    p.model_dump(mode="json"),
                )
        except Exception:
            pass
        for p in new_posts:
            try:
                await wsp.publish_social_post_created(
                    universe_id=ctx.universe_id,
                    post_id=p.post_id,
                    author_id=p.author_actor_id,
                    tick=ctx.tick,
                    content_summary=p.content[:120],
                )
            except Exception:
                pass

    for e in new_events:
        session.add(EventModel.from_schema(e))
    if new_events:
        await session.flush()

    # Persist parsed_decisions.
    try:
        artwriters.write_parsed_decisions(
            ledger, ctx.universe_id, ctx.tick, parsed_decisions_serialised
        )
    except (ImmutabilityError, Exception) as exc:
        _log.debug("parsed_decisions write skipped: %s", exc)

    # ---- update_private_states: insert next-tick state rows ---------
    next_tick = ctx.tick  # write at current_tick (transitions module convention)
    cohort_rows_by_id = {r.cohort_id: r for r in cohort_rows}
    hero_rows_by_id = {r.hero_id: r for r in hero_rows}

    for cid, ratings in self_ratings.items():
        row = cohort_rows_by_id.get(cid)
        if row is None:
            continue
        target = row
        if row.tick != next_tick:
            target = _clone_cohort_to_tick(row, next_tick)
            session.add(target)
        em = ratings.get("emotions") or {}
        if isinstance(em, dict) and em:
            merged = dict(target.emotions or {})
            for k, v in em.items():
                try:
                    merged[k] = max(0.0, min(10.0, float(v)))
                except (ValueError, TypeError):
                    continue
            target.emotions = merged
            try:
                flag_modified(target, "emotions")
            except Exception:
                pass
        st = ratings.get("issue_stance") or {}
        if isinstance(st, dict) and st:
            merged_st = dict(target.issue_stance or {})
            for k, v in st.items():
                try:
                    merged_st[k] = max(-1.0, min(1.0, float(v)))
                except (ValueError, TypeError):
                    continue
            target.issue_stance = merged_st
            try:
                flag_modified(target, "issue_stance")
            except Exception:
                pass
        wts = ratings.get("willingness_to_speak")
        if isinstance(wts, (int, float)):
            target.willingness_to_speak = max(0.0, min(1.0, float(wts)))

    for hid, ratings in self_ratings.items():
        row = hero_rows_by_id.get(hid)
        if row is None:
            continue
        target = row
        if row.tick != next_tick:
            target = _clone_hero_to_tick(row, next_tick)
            session.add(target)
        em = ratings.get("emotions") or {}
        if isinstance(em, dict) and em:
            merged = dict(target.current_emotions or {})
            for k, v in em.items():
                try:
                    merged[k] = max(0.0, min(10.0, float(v)))
                except (ValueError, TypeError):
                    continue
            target.current_emotions = merged
            try:
                flag_modified(target, "current_emotions")
            except Exception:
                pass

    if self_ratings:
        await session.flush()

    # ---- run_all_transitions (sociology) -----------------------------
    transitions_summary: dict = {}
    try:
        transitions_summary = await run_all_transitions(
            session=session,
            universe_id=ctx.universe_id,
            current_tick=ctx.tick,
            sot=sot,
            ledger=None,
        )
    except Exception as exc:
        _log.warning("run_all_transitions failed: %s", exc)

    # ---- handle splits/merges ---------------------------------------
    splits_committed = 0
    if split_proposals_per_cohort:
        # Re-read latest cohort rows at current tick.
        cur_rows_q = select(CohortStateModel).where(
            CohortStateModel.universe_id == ctx.universe_id,
            CohortStateModel.tick == ctx.tick,
            CohortStateModel.is_active.is_(True),
        )
        cur_rows = list((await session.execute(cur_rows_q)).scalars().all())
        cur_rows_by_id = {r.cohort_id: r for r in cur_rows}

        from backend.app.schemas.sociology import SplitProposal
        for parent_cid, proposals in split_proposals_per_cohort.items():
            parent_row = cur_rows_by_id.get(parent_cid)
            if parent_row is None:
                continue
            archetype = archetypes_by_id.get(parent_row.archetype_id)
            if archetype is None:
                continue
            for raw in proposals:
                try:
                    raw = _adapt_split_tool_payload(
                        raw,
                        parent_row=parent_row,
                        parent_cohort_id=parent_cid,
                        split_distance_threshold=params.split_merge.split_distance_threshold,
                    )
                    proposal = SplitProposal.model_validate(raw)
                    children = await commit_split(
                        session,
                        parent=parent_row,
                        proposal=proposal,
                        current_tick=ctx.tick,
                        archetype=archetype,
                        params=params,
                    )
                    splits_committed += 1
                    try:
                        await wsp.publish_cohort_split(
                            universe_id=ctx.universe_id,
                            parent_cohort_id=parent_cid,
                            child_cohort_ids=[c.cohort_id for c in children],
                            tick=ctx.tick,
                        )
                    except Exception:
                        pass
                except Exception as exc:  # noqa: BLE001
                    _log.warning(
                        "split proposal failed for %s: %s", parent_cid, exc,
                    )

    # ---- audit population conservation ------------------------------
    pop_errors: list[str] = []
    try:
        pop_errors = await audit_population_conservation(
            session, ctx.universe_id, ctx.tick
        )
    except Exception as exc:
        _log.warning("audit_population_conservation failed: %s", exc)
    if pop_errors:
        _log.critical("population conservation errors: %s", pop_errors)

    # ---- update_graphs: persist multiplex graph layer JSONL ----------
    try:
        from backend.app.sociology.graphs import MultiplexGraph

        cur_state_q = select(CohortStateModel).where(
            CohortStateModel.universe_id == ctx.universe_id,
            CohortStateModel.tick == ctx.tick,
            CohortStateModel.is_active.is_(True),
        )
        cur_state_rows = list((await session.execute(cur_state_q)).scalars().all())
        cur_state_schemas = [r.to_schema() for r in cur_state_rows]
        mg = MultiplexGraph.from_state(cohorts=cur_state_schemas, heroes=hero_states)
        for layer in MultiplexGraph.LAYERS:
            rows = mg.to_jsonl_rows(layer)
            for row in rows:
                ledger.append_jsonl(
                    f"universes/{ctx.universe_id}/ticks/tick_{ctx.tick:03d}/sociology/graphs.jsonl",
                    row,
                )
    except Exception as exc:
        _log.debug("graph persist skipped: %s", exc)

    # ---- memory writes (P2 fire-and-forget) -------------------------
    if memory is not None:
        for c in cohort_states:
            _fire_and_forget_memory(
                memory.add_episode(
                    session_id=c.memory_session_id or f"{c.cohort_id}:{ctx.universe_id}",
                    role=c.cohort_id,
                    role_type="user",
                    content=f"Tick {ctx.tick} private state update.",
                    metadata={"tick": ctx.tick},
                ),
                tag=f"add_episode:{c.cohort_id}",
            )
            _fire_and_forget_memory(
                memory.end_of_tick_summary(
                    actor_id=c.cohort_id,
                    universe_id=ctx.universe_id,
                    tick=ctx.tick,
                    summary_text=f"End of tick {ctx.tick}.",
                ),
                tag=f"end_of_tick_summary:{c.cohort_id}",
            )

    # ---- compute metrics --------------------------------------------
    cur_state_q = select(CohortStateModel).where(
        CohortStateModel.universe_id == ctx.universe_id,
        CohortStateModel.tick == ctx.tick,
    )
    cur_state_rows = list((await session.execute(cur_state_q)).scalars().all())
    cur_state_schemas = [r.to_schema() for r in cur_state_rows]

    all_events_q = select(EventModel).where(EventModel.universe_id == ctx.universe_id)
    all_events_rows = list((await session.execute(all_events_q)).scalars().all())
    all_events_schemas = [r.to_schema() for r in all_events_rows]

    metrics = compute_universe_metrics(
        cur_state_schemas,
        all_events_schemas,
        new_posts,  # this-tick posts
        prev_metrics=dict(universe.latest_metrics or {}),
        tick=ctx.tick,
    )
    try:
        ledger.write_artifact(
            f"universes/{ctx.universe_id}/ticks/tick_{ctx.tick:03d}/metrics.json",
            metrics,
            immutable=True,
        )
    except (ImmutabilityError, Exception) as exc:
        _log.debug("metrics write skipped: %s", exc)

    # ---- god review --------------------------------------------------
    god_decision: GodReviewOutput | None = None
    god_review_error: str | None = None
    try:
        god_input = GodReviewInput(
            universe_id=ctx.universe_id,
            run_id=ctx.run_id,
            current_tick=ctx.tick,
            universe_state_summary={
                "universe_id": ctx.universe_id,
                "current_tick": ctx.tick,
                "branch_depth": universe.branch_depth,
                "lineage_path": list(universe.lineage_path or [ctx.universe_id]),
                "status": universe.status,
                "active_cohorts": metrics.get("active_cohorts", 0),
            },
            recent_ticks=[],
            event_proposals=[ev.model_dump(mode="json") for ev in resolved_events],
            social_posts=[p.model_dump(mode="json") for p in new_posts],
            metrics=metrics,
            branch_candidates=[],
            rate_limit_state={},
            budget_state={},
            prior_branch_history=[],
        )
        god_decision = await god_review(
            god_input,
            sot=sot,
            routing=routing,
            limiter=limiter,
            ledger=ledger,
        )
    except Exception as exc:  # noqa: BLE001
        god_review_error = str(exc)
        _log.warning("god_review failed: %s", exc)

    # ---- branch policy + branch dispatch ----------------------------
    branch_action: dict = {"decided": False}
    if god_decision is not None:
        decision_label = god_decision.decision

        # Apply lifecycle decisions immediately.
        if decision_label == "freeze":
            universe.status = "frozen"
            universe.frozen_at = now_utc()
            try:
                await wsp.publish_branch_frozen(
                    run_id=ctx.run_id, universe_id=ctx.universe_id,
                    frozen_at_tick=ctx.tick,
                )
            except Exception:
                pass
        elif decision_label == "kill":
            universe.status = "killed"
            universe.killed_at = now_utc()
            try:
                await wsp.publish_branch_killed(
                    run_id=ctx.run_id, universe_id=ctx.universe_id,
                    killed_at_tick=ctx.tick,
                    reason=(god_decision.tick_summary or "")[:200],
                )
            except Exception:
                pass

        # Branch decisions: build a snapshot + ask the policy gate.
        if decision_label in ("spawn_candidate", "spawn_active"):
            policy, snapshot = await _load_branch_policy_snapshot(
                session=session,
                run_id=ctx.run_id,
                parent_universe_id=ctx.universe_id,
                parent_tick=ctx.tick,
                parent_depth=universe.branch_depth,
            )
            policy_result = evaluate_branch_policy(
                parent_universe_id=ctx.universe_id,
                parent_current_tick=ctx.tick,
                proposed_decision=god_decision,
                multiverse=snapshot,
                policy=policy,
            )
            branch_action["policy_result"] = policy_result.model_dump(mode="json")

            if policy_result.decision in ("approve", "downgrade_to_candidate"):
                # Enqueue branch_universe job.
                try:
                    delta_payload = (
                        god_decision.branch_delta.model_dump(mode="json")
                        if god_decision.branch_delta else None
                    )
                    envelope = scheduler.make_envelope(
                        job_type="branch_universe",
                        run_id=ctx.run_id,
                        universe_id=ctx.universe_id,
                        tick=ctx.tick,
                        payload={
                            "parent_universe_id": ctx.universe_id,
                            "branch_from_tick": ctx.tick,
                            "delta": delta_payload,
                            "reason": (god_decision.tick_summary or "")[:200],
                            "policy_decision": policy_result.decision,
                        },
                    )
                    await scheduler.enqueue(envelope)
                    branch_action["enqueued"] = True
                    branch_action["job_id"] = envelope.job_id
                except Exception as exc:
                    _log.debug("branch enqueue skipped: %s", exc)
                    branch_action["enqueued"] = False

        try:
            await wsp.publish_god_decision(
                universe_id=ctx.universe_id,
                run_id=ctx.run_id,
                tick=ctx.tick,
                decision=decision_label,
                branch_delta=(
                    god_decision.branch_delta.model_dump(mode="json")
                    if god_decision.branch_delta else None
                ),
            )
        except Exception:
            pass

    return {
        "new_posts": len(new_posts),
        "new_events": len(new_events),
        "self_ratings_applied": len(self_ratings),
        "transitions": transitions_summary,
        "splits_committed": splits_committed,
        "pop_errors": pop_errors,
        "metrics": metrics,
        "god_decision": (
            god_decision.model_dump(mode="json") if god_decision else None
        ),
        "god_review_error": god_review_error,
        "branch_action": branch_action,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clone_cohort_to_tick(src: Any, new_tick: int) -> Any:
    """Build a shallow copy of a CohortStateModel row at ``new_tick``."""
    cls = type(src)
    return cls(
        cohort_id=src.cohort_id,
        tick=new_tick,
        universe_id=src.universe_id,
        archetype_id=src.archetype_id,
        parent_cohort_id=src.parent_cohort_id,
        child_cohort_ids=list(src.child_cohort_ids or []),
        represented_population=src.represented_population,
        population_share_of_archetype=src.population_share_of_archetype,
        issue_stance=dict(src.issue_stance or {}),
        expression_level=src.expression_level,
        mobilization_mode=src.mobilization_mode,
        speech_mode=src.speech_mode,
        emotions=dict(src.emotions or {}),
        behavior_state=dict(src.behavior_state or {}),
        attention=src.attention,
        fatigue=src.fatigue,
        grievance=src.grievance,
        perceived_efficacy=src.perceived_efficacy,
        perceived_majority=dict(src.perceived_majority or {}),
        fear_of_isolation=src.fear_of_isolation,
        willingness_to_speak=src.willingness_to_speak,
        identity_salience=src.identity_salience,
        visible_trust_summary=dict(src.visible_trust_summary or {}),
        exposure_summary=dict(src.exposure_summary or {}),
        dependency_summary=dict(src.dependency_summary or {}),
        memory_session_id=src.memory_session_id,
        recent_post_ids=list(src.recent_post_ids or []),
        queued_event_ids=list(src.queued_event_ids or []),
        previous_action_ids=list(src.previous_action_ids or []),
        prompt_temperature=src.prompt_temperature,
        representation_mode=src.representation_mode,
        allowed_tools=list(src.allowed_tools or []),
        is_active=src.is_active,
    )


def _clone_hero_to_tick(src: Any, new_tick: int) -> Any:
    """Build a shallow copy of a HeroStateModel row at ``new_tick``."""
    cls = type(src)
    return cls(
        hero_id=src.hero_id,
        tick=new_tick,
        universe_id=src.universe_id,
        current_emotions=dict(src.current_emotions or {}),
        current_issue_stances=dict(src.current_issue_stances or {}),
        attention=src.attention,
        fatigue=src.fatigue,
        perceived_pressure=src.perceived_pressure,
        current_strategy=src.current_strategy,
        queued_events=list(src.queued_events or []),
        recent_posts=list(src.recent_posts or []),
        memory_session_id=src.memory_session_id,
    )


def _adapt_split_tool_payload(
    raw: Any,
    *,
    parent_row: Any,
    parent_cohort_id: str,
    split_distance_threshold: float,
) -> dict:
    """Adapt the SoT `propose_split.args` shape into engine SplitProposal."""
    payload = dict(raw or {})
    if payload.get("tool_id") == "propose_split" and isinstance(payload.get("args"), dict):
        payload = dict(payload["args"])

    if "children" in payload:
        payload.setdefault("parent_cohort_id", parent_cohort_id)
        payload.setdefault("split_distance", max(0.5, split_distance_threshold))
        return payload

    proposed = payload.get("proposed_children")
    if not isinstance(proposed, list):
        payload.setdefault("parent_cohort_id", parent_cohort_id)
        return payload

    parent_pop = max(int(parent_row.represented_population or 0), 0)
    shares: list[float] = []
    for child in proposed:
        if isinstance(child, dict):
            try:
                shares.append(max(0.0, float(child.get("population_share", 0.0))))
            except (TypeError, ValueError):
                shares.append(0.0)
    share_total = sum(shares) or 1.0

    children: list[dict] = []
    assigned = 0
    max_delta = 0.0
    for idx, child in enumerate(proposed):
        if not isinstance(child, dict):
            continue
        share = shares[idx] / share_total if idx < len(shares) else 0.0
        if idx == len(proposed) - 1:
            represented_population = max(0, parent_pop - assigned)
        else:
            represented_population = max(0, int(round(parent_pop * share)))
            assigned += represented_population

        parent_stance = dict(parent_row.issue_stance or {})
        stance_delta = child.get("issue_stance_delta") or {}
        if isinstance(stance_delta, dict):
            for key, value in stance_delta.items():
                try:
                    delta_value = float(value)
                except (TypeError, ValueError):
                    continue
                parent_stance[key] = max(-1.0, min(1.0, float(parent_stance.get(key, 0.0)) + delta_value))
                max_delta = max(max_delta, abs(delta_value))

        seed_emotions = dict(parent_row.emotions or {})
        emotion_delta = child.get("emotion_delta") or {}
        if isinstance(emotion_delta, dict):
            for key, value in emotion_delta.items():
                try:
                    delta_value = float(value)
                except (TypeError, ValueError):
                    continue
                seed_emotions[key] = max(0.0, min(10.0, float(seed_emotions.get(key, 5.0)) + delta_value))
                max_delta = max(max_delta, min(1.0, abs(delta_value) / 10.0))

        try:
            expression = float(child.get("expression_level_hint", parent_row.expression_level))
        except (TypeError, ValueError):
            expression = float(parent_row.expression_level)
        expression = max(0.0, min(1.0, expression))
        max_delta = max(max_delta, abs(expression - float(parent_row.expression_level)))

        children.append(
            {
                "archetype_id": parent_row.archetype_id,
                "represented_population": represented_population,
                "issue_stance": parent_stance,
                "expression_level": expression,
                "mobilization_mode": parent_row.mobilization_mode,
                "speech_mode": parent_row.speech_mode,
                "seed_emotions": seed_emotions,
                "interpretation_note": str(
                    child.get("differentiator")
                    or child.get("label_hint")
                    or "LLM proposed split child"
                )[:800],
            }
        )

    return {
        "parent_cohort_id": parent_cohort_id,
        "children": children,
        "split_distance": max(float(split_distance_threshold), max_delta, 0.35),
        "rationale": str(payload.get("rationale") or "LLM proposed split")[:800],
    }


async def _load_branch_policy_snapshot(
    *,
    session: AsyncSession,
    run_id: str,
    parent_universe_id: str,
    parent_tick: int,
    parent_depth: int,
) -> tuple[BranchPolicy, MultiverseSnapshot]:
    from backend.app.models.branches import BranchNodeModel
    from backend.app.models.settings import BranchPolicySettingModel
    from backend.app.models.universes import UniverseModel

    policy_row = await session.get(BranchPolicySettingModel, "default")
    if policy_row is None:
        policy = BranchPolicy(
            max_active_universes=50,
            max_total_branches=500,
            max_depth=8,
            max_branches_per_tick=5,
            branch_cooldown_ticks=3,
            min_divergence_score=0.35,
            auto_prune_low_value=True,
        )
    else:
        policy = BranchPolicy(
            max_active_universes=policy_row.max_active_universes,
            max_total_branches=policy_row.max_total_branches,
            max_depth=policy_row.max_depth,
            max_branches_per_tick=policy_row.max_branches_per_tick,
            branch_cooldown_ticks=policy_row.branch_cooldown_ticks,
            min_divergence_score=policy_row.min_divergence_score,
            auto_prune_low_value=policy_row.auto_prune_low_value,
        )

    active_count = (
        await session.execute(
            select(func.count(UniverseModel.universe_id)).where(
                UniverseModel.big_bang_id == run_id,
                UniverseModel.status == "active",
            )
        )
    ).scalar_one()
    total_branches = (
        await session.execute(
            select(func.count(UniverseModel.universe_id)).where(
                UniverseModel.big_bang_id == run_id,
                UniverseModel.parent_universe_id.is_not(None),
            )
        )
    ).scalar_one()
    max_depth = (
        await session.execute(
            select(func.max(UniverseModel.branch_depth)).where(
                UniverseModel.big_bang_id == run_id
            )
        )
    ).scalar_one() or parent_depth
    branches_this_tick = (
        await session.execute(
            select(func.count(UniverseModel.universe_id)).where(
                UniverseModel.big_bang_id == run_id,
                UniverseModel.parent_universe_id.is_not(None),
                UniverseModel.branch_from_tick == parent_tick,
            )
        )
    ).scalar_one()

    branch_rows = (
        await session.execute(
            select(BranchNodeModel.parent_universe_id, BranchNodeModel.branch_tick)
            .join(UniverseModel, BranchNodeModel.universe_id == UniverseModel.universe_id)
            .where(UniverseModel.big_bang_id == run_id)
        )
    ).all()
    last_branch_tick: dict[str, int] = {}
    for parent_id, branch_tick in branch_rows:
        if parent_id:
            last_branch_tick[parent_id] = max(
                last_branch_tick.get(parent_id, -1), int(branch_tick)
            )

    return policy, MultiverseSnapshot(
        big_bang_id=run_id,
        active_universe_count=int(active_count),
        total_branch_count=int(total_branches),
        max_depth_reached=int(max_depth),
        branches_this_tick=int(branches_this_tick),
        last_branch_tick_per_universe=last_branch_tick,
        parent_metrics_history={parent_universe_id: []},
    )


async def _build_state_after(
    *,
    session: AsyncSession,
    universe_id: str,
    tick: int,
    metrics: dict,
) -> dict:
    """Assemble the state_after.json payload from current DB state."""
    from backend.app.models.cohorts import CohortStateModel
    from backend.app.models.heroes import HeroStateModel

    cohort_rows = (await session.execute(
        select(CohortStateModel).where(
            CohortStateModel.universe_id == universe_id,
            CohortStateModel.tick == tick,
        )
    )).scalars().all()

    hero_rows = (await session.execute(
        select(HeroStateModel).where(
            HeroStateModel.universe_id == universe_id,
            HeroStateModel.tick == tick,
        )
    )).scalars().all()

    return {
        "universe_id": universe_id,
        "tick": tick,
        "metrics": metrics,
        "cohorts": [r.to_schema().model_dump(mode="json") for r in cohort_rows],
        "heroes": [r.to_schema().model_dump(mode="json") for r in hero_rows],
        "cohort_count": len(cohort_rows),
        "hero_count": len(hero_rows),
    }


def _fire_and_forget_memory(coro: Awaitable, *, tag: str) -> None:
    """Schedule a memory write as fire-and-forget; log exceptions on done."""
    try:
        task = asyncio.create_task(coro)
    except RuntimeError:
        # Not in an event loop — silently drop (no awaitable runner).
        return

    def _log_exc(t: asyncio.Task) -> None:
        try:
            exc = t.exception()
        except Exception:
            return
        if exc:
            _log.warning("memory write %s failed: %s", tag, exc)

    task.add_done_callback(_log_exc)


__all__ = [
    "TickContext",
    "run_tick",
]
