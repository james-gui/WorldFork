"""Integration tests for backend.app.simulation.tick_runner.

Exercises the §11.1 loop end-to-end via :func:`run_tick_locally` (the
test harness for the Celery-based `simulate_universe_tick` task).

Three test classes:

* :class:`TestTickRunnerHappyPath` — seeds 2 cohorts, 1 hero, 1
  scheduled event at tick=1; mocks ``call_with_policy`` so cohort/hero
  agents emit canned ``create_social_post`` decisions and the god agent
  returns ``continue``.  Asserts new posts, resolved event, mutated
  cohort_state rows, god/decision.json, metrics, state_after.json.

* :class:`TestTickRunnerFrozen` — universe.status == "frozen" → run_tick
  short-circuits without side effects.

* :class:`TestTickRunnerIdempotency` — invokes run_tick twice with the
  same idempotency key; second invocation returns ``already_running``.

* :class:`TestTickRunnerSpawnActiveBranch` — god agent returns
  ``spawn_active`` with a delta; verifies the branch_universe envelope
  is enqueued.
"""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import fakeredis.aioredis
import pytest
import pytest_asyncio
from sqlalchemy import select

from backend.app.providers import (
    ProviderRateLimiter,
    RoutingTable,
    clear_registry,
    register_provider,
)
from backend.app.providers.base import BaseProvider
from backend.app.schemas.llm import LLMResult
from backend.app.simulation.local_runner import run_tick_locally
from backend.app.simulation.tick_runner import TickContext

pytestmark = [pytest.mark.asyncio]


# ---------------------------------------------------------------------------
# Canned LLM payloads
# ---------------------------------------------------------------------------


def _canned_cohort_decision() -> dict:
    """A minimal valid cohort_decision payload."""
    return {
        "public_actions": [],
        "event_actions": [],
        "social_actions": [
            {
                "tool_id": "create_social_post",
                "args": {
                    "platform": "twitter",
                    "content": "Cohort tick post",
                    "visibility_scope": "public",
                    "stance_signal": {},
                    "emotion_signal": {"anger": 4.0},
                    "credibility_signal": 0.6,
                },
            }
        ],
        "self_ratings": {
            "emotions": {"anger": 6.5, "fear": 3.0},
            "issue_stance": {},
            "perceived_majority": {},
            "willingness_to_speak": 0.7,
        },
        "split_merge_proposals": [],
        "decision_rationale": {
            "main_factors": ["test_factor"],
            "uncertainty": "medium",
        },
    }


def _canned_hero_decision() -> dict:
    """A minimal valid hero_decision payload."""
    return {
        "public_actions": [],
        "event_actions": [],
        "social_actions": [],
        "self_ratings": {
            "emotions": {},
            "issue_stance": {},
            "perceived_majority": {},
            "willingness_to_speak": 0.5,
        },
        "decision_rationale": {
            "main_factors": ["hero_factor"],
            "uncertainty": "low",
        },
    }


def _canned_god_continue() -> dict:
    return {
        "decision": "continue",
        "branch_delta": None,
        "marked_key_events": [],
        "tick_summary": "All systems nominal.",
        "rationale": {"main_factors": ["stable_metrics"]},
    }


def _canned_god_spawn_active(target_event_id: str) -> dict:
    return {
        "decision": "spawn_active",
        "branch_delta": {
            "type": "counterfactual_event_rewrite",
            "target_event_id": target_event_id,
            "parent_version": "original",
            "child_version": "alternate",
        },
        "marked_key_events": [target_event_id],
        "tick_summary": "Forking on key event.",
        "rationale": {"main_factors": ["divergence_opportunity"]},
    }


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------


class _RoutingProvider(BaseProvider):
    """Provider that returns different canned payloads based on actor_kind.

    Inspects ``prompt.actor_kind`` to choose the canned response.
    """

    def __init__(
        self,
        *,
        cohort_payload: dict | None = None,
        hero_payload: dict | None = None,
        god_payload: dict | None = None,
    ) -> None:
        self.name = "openrouter"
        self.cohort_payload = cohort_payload or _canned_cohort_decision()
        self.hero_payload = hero_payload or _canned_hero_decision()
        self.god_payload = god_payload or _canned_god_continue()
        self.calls: list[str] = []

    async def generate_structured(self, prompt, config):
        kind = prompt.actor_kind
        self.calls.append(kind)
        if kind == "cohort":
            payload = self.cohort_payload
        elif kind == "hero":
            payload = self.hero_payload
        elif kind == "god":
            payload = self.god_payload
        else:
            payload = {}
        return LLMResult(
            call_id=self._make_call_id("mock"),
            provider=self.name,
            model_used=config.model,
            prompt_tokens=200,
            completion_tokens=400,
            total_tokens=600,
            cost_usd=0.001,
            latency_ms=20,
            parsed_json=dict(payload),
            tool_calls=[],
            raw_response={"id": "mock-tick", "model": config.model},
            created_at=datetime.now(UTC),
            repaired_once=False,
        )

    async def generate_text(self, prompt, config):
        return await self.generate_structured(prompt, config)

    async def embed(self, texts, config):
        raise NotImplementedError

    async def healthcheck(self):
        from backend.app.schemas.llm import ProviderHealth
        return ProviderHealth(provider=self.name, ok=True, latency_ms=1, details={})


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def fake_redis():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
def rate_limiter(fake_redis) -> ProviderRateLimiter:
    return ProviderRateLimiter(
        fake_redis,
        provider="openrouter",
        rpm_limit=600,
        tpm_limit=1_000_000,
        max_concurrency=8,
        daily_budget_usd=None,
        jitter=False,
    )


@pytest.fixture
def routing() -> RoutingTable:
    return RoutingTable.defaults()


@pytest.fixture(autouse=True)
def _provider_registry_reset():
    clear_registry()
    yield
    clear_registry()


@pytest_asyncio.fixture
async def patched_redis(monkeypatch, fake_redis):
    """Patch ``get_redis_client`` so scheduler/pubsub use the fake."""
    from backend.app.core import redis_client as rc

    monkeypatch.setattr(rc, "get_redis_client", lambda: fake_redis)
    # Also patch any module-cached imports.
    from backend.app.workers import scheduler as sched
    monkeypatch.setattr(
        "backend.app.core.redis_client.get_redis_client",
        lambda: fake_redis,
    )
    yield fake_redis


@pytest_asyncio.fixture
async def seeded_universe(db_session, tmp_path, request):
    """Seed a Big Bang run with 2 cohorts, 1 hero, and 1 scheduled event at tick=1.

    Returns a dict with the relevant ids + the open ledger.  Ids are
    suffixed with the test node id so multiple tests reusing the
    session-scoped SQLite engine don't collide.
    """
    import hashlib

    from backend.app.models.cohorts import (
        CohortStateModel,
        PopulationArchetypeModel,
    )
    from backend.app.models.events import EventModel
    from backend.app.models.heroes import HeroArchetypeModel, HeroStateModel
    from backend.app.models.runs import BigBangRunModel
    from backend.app.models.universes import UniverseModel
    from backend.app.storage.ledger import Ledger

    suffix = hashlib.md5(request.node.nodeid.encode()).hexdigest()[:8]

    big_bang_id = f"BB_tr_{suffix}"
    universe_id = f"U_tr_{suffix}"
    arch_a_id = f"arch_merchants_{suffix}"
    arch_b_id = f"arch_commuters_{suffix}"
    cohort_a_id = f"coh_merchants_{suffix}"
    cohort_b_id = f"coh_commuters_{suffix}"
    hero_id = f"hero_mayor_{suffix}"
    event_id = f"evt_tick1_announce_{suffix}"

    now = datetime.now(UTC)

    # Begin a real ledger so the tick runner has somewhere to write.
    ledger = Ledger.begin_run(
        tmp_path,
        big_bang_id,
        scenario_text="Bay Area bus-lane debate",
        sot_snapshot_sha="0" * 64,
        config_snapshot={"max_ticks": 10, "tick_duration_minutes": 60},
    )
    ledger.begin_universe(
        universe_id,
        parent=None,
        branch_from_tick=0,
        branch_delta=None,
    )

    # BigBangRun row
    db_session.add(
        BigBangRunModel(
            big_bang_id=big_bang_id,
            display_name="TickRunner Test",
            scenario_text="Bay Area bus-lane debate",
            input_file_ids=[],
            status="running",
            time_horizon_label="1 month",
            tick_duration_minutes=60,
            max_ticks=10,
            max_schedule_horizon_ticks=5,
            source_of_truth_version="1.0.0",
            source_of_truth_snapshot_path=str(ledger.run_folder / "source_of_truth_snapshot"),
            provider_snapshot_id="provsnap-test",
            root_universe_id=universe_id,
            run_folder_path=str(ledger.run_folder),
            safe_edit_metadata={},
            created_by_user_id=None,
            created_at=now,
            updated_at=now,
        )
    )
    await db_session.flush()

    db_session.add(
        UniverseModel(
            universe_id=universe_id,
            big_bang_id=big_bang_id,
            parent_universe_id=None,
            lineage_path=[universe_id],
            branch_from_tick=0,
            branch_depth=0,
            status="active",
            branch_reason="",
            branch_delta=None,
            current_tick=0,
            latest_metrics={},
            created_at=now,
        )
    )
    await db_session.flush()

    def _arch(arch_id: str, label: str, pop: int) -> PopulationArchetypeModel:
        return PopulationArchetypeModel(
            archetype_id=arch_id,
            big_bang_id=big_bang_id,
            label=label,
            description="seed archetype",
            population_total=pop,
            geography={},
            age_band=None,
            education_profile=None,
            occupation_or_role=None,
            socioeconomic_band=None,
            institution_membership=[],
            demographic_tags=[],
            issue_exposure=0.5,
            material_stake=0.5,
            symbolic_stake=0.4,
            vulnerability_to_policy=0.4,
            ability_to_influence_outcome=0.4,
            ideology_axes={},
            value_priors={},
            behavior_axes={},
            baseline_media_diet={},
            preferred_channels=["mainstream_news"],
            platform_access={},
            attention_capacity=0.7,
            attention_decay_rate=0.1,
            baseline_trust_priors={},
            identity_tags=[],
            ingroup_affinities={},
            outgroup_distances={},
            allowed_action_classes=["read", "social", "event_minor"],
            coordination_capacity=0.5,
            mobilization_capacity=0.5,
            legal_or_status_risk_sensitivity=0.4,
            min_split_population=20,
            min_split_share=0.1,
            max_child_cohorts=4,
        )

    db_session.add(_arch(arch_a_id, "Merchants", 100))
    db_session.add(_arch(arch_b_id, "Commuters", 200))
    await db_session.flush()

    def _cohort(cid: str, arch_id: str, pop: int) -> CohortStateModel:
        return CohortStateModel(
            cohort_id=cid,
            tick=0,
            universe_id=universe_id,
            archetype_id=arch_id,
            parent_cohort_id=None,
            child_cohort_ids=[],
            represented_population=pop,
            population_share_of_archetype=1.0,
            issue_stance={"primary": 0.0},
            expression_level=0.6,
            mobilization_mode="dormant",
            speech_mode="public",
            emotions={"anger": 3.0, "fear": 2.0, "hope": 5.0, "trust": 4.0},
            behavior_state={},
            attention=0.6,
            fatigue=0.1,
            grievance=0.3,
            perceived_efficacy=0.5,
            perceived_majority={},
            fear_of_isolation=0.2,
            willingness_to_speak=0.5,
            identity_salience=0.5,
            visible_trust_summary={},
            exposure_summary={},
            dependency_summary={},
            memory_session_id=None,
            recent_post_ids=[],
            queued_event_ids=[],
            previous_action_ids=[],
            prompt_temperature=0.6,
            representation_mode="small",
            allowed_tools=[],
            is_active=True,
        )

    db_session.add(_cohort(cohort_a_id, arch_a_id, 100))
    db_session.add(_cohort(cohort_b_id, arch_b_id, 200))
    await db_session.flush()

    # Hero archetype + state.
    db_session.add(
        HeroArchetypeModel(
            hero_id=hero_id,
            big_bang_id=big_bang_id,
            label="Mayor",
            description="The town mayor",
            role="mayor",
            institution=None,
            location_scope="city",
            public_reach=0.7,
            institutional_power=0.8,
            financial_power=0.4,
            agenda_control=0.6,
            media_access=0.7,
            ideology_axes={},
            value_priors={},
            trust_priors={},
            behavioral_axes={},
            volatility=0.3,
            ego_sensitivity=0.5,
            strategic_discipline=0.6,
            controversy_tolerance=0.4,
            direct_event_power=0.6,
            scheduling_permissions=[],
            allowed_channels=["mainstream_news"],
        )
    )
    await db_session.flush()

    db_session.add(
        HeroStateModel(
            hero_id=hero_id,
            tick=0,
            universe_id=universe_id,
            current_emotions={"hope": 5.0, "anger": 2.0},
            current_issue_stances={"primary": 0.2},
            attention=0.7,
            fatigue=0.1,
            perceived_pressure=0.4,
            current_strategy="",
            queued_events=[],
            recent_posts=[],
            memory_session_id=None,
        )
    )
    await db_session.flush()

    # One scheduled event at tick 1.
    db_session.add(
        EventModel(
            event_id=event_id,
            universe_id=universe_id,
            created_tick=0,
            scheduled_tick=1,
            duration_ticks=1,
            event_type="policy_announcement",
            title="Announcement",
            description="The city announces something.",
            created_by_actor_id=hero_id,
            participants=[hero_id],
            target_audience=[arch_a_id, arch_b_id, cohort_a_id, cohort_b_id],
            visibility="public",
            preconditions=[],
            expected_effects={"attention_boost": 0.4},
            actual_effects=None,
            risk_level=0.4,
            status="scheduled",
            parent_event_id=None,
            source_llm_call_id=None,
        )
    )
    await db_session.flush()
    await db_session.commit()

    return {
        "big_bang_id": big_bang_id,
        "universe_id": universe_id,
        "cohort_a_id": cohort_a_id,
        "cohort_b_id": cohort_b_id,
        "arch_a_id": arch_a_id,
        "arch_b_id": arch_b_id,
        "hero_id": hero_id,
        "event_id": event_id,
        "ledger": ledger,
    }


# ---------------------------------------------------------------------------
# TestTickRunnerHappyPath
# ---------------------------------------------------------------------------


class TestTickRunnerHappyPath:
    """Mock provider returns canned cohort/hero/god decisions; verify side effects."""

    async def test_full_tick_happy_path(
        self,
        db_session,
        seeded_universe,
        rate_limiter,
        routing,
        patched_redis,
    ):
        from backend.app.models.cohorts import CohortStateModel
        from backend.app.models.events import EventModel
        from backend.app.models.posts import SocialPostModel
        from backend.app.models.universes import UniverseModel

        register_provider(
            "openrouter",
            _RoutingProvider(),  # all canned defaults: continue
        )

        ctx = TickContext(
            run_id=seeded_universe["big_bang_id"],
            universe_id=seeded_universe["universe_id"],
            tick=1,
            attempt_number=1,
        )

        result = await run_tick_locally(
            ctx,
            session=db_session,
            ledger=seeded_universe["ledger"],
            routing=routing,
            limiter=rate_limiter,
            memory=None,
        )

        assert result["status"] == "completed", result
        assert result["resolved_events"] == 1
        # active selection should fire for both cohorts (event_salience>0).
        assert result["active_cohorts"] >= 2

        # ---- Posts inserted (≥2 — one per active cohort + maybe news) -----
        posts_q = select(SocialPostModel).where(
            SocialPostModel.universe_id == seeded_universe["universe_id"],
            SocialPostModel.tick_created == 1,
        )
        posts = (await db_session.execute(posts_q)).scalars().all()
        # 2 cohorts each emit a create_social_post + 1 news post = 3.
        assert len(posts) >= 2, f"expected ≥2 posts, got {len(posts)}"

        # ---- Resolved event status flipped --------------------------------
        ev = await db_session.get(EventModel, seeded_universe["event_id"])
        assert ev is not None
        assert ev.status == "active"
        assert ev.actual_effects is not None

        # ---- New cohort_state rows at tick=1 with mutated emotions -------
        cs_q = select(CohortStateModel).where(
            CohortStateModel.universe_id == seeded_universe["universe_id"],
            CohortStateModel.tick == 1,
        )
        cs_rows = (await db_session.execute(cs_q)).scalars().all()
        assert len(cs_rows) >= 2
        # At least one cohort should have anger=6.5 (from canned self_ratings).
        anger_vals = [r.emotions.get("anger", 0) for r in cs_rows]
        assert any(abs(a - 6.5) < 0.01 for a in anger_vals), (
            f"expected anger=6.5 in {anger_vals}"
        )

        # ---- god/decision.json artifact ----------------------------------
        god_path = (
            seeded_universe["ledger"].run_folder
            / "universes" / seeded_universe["universe_id"]
            / "ticks" / "tick_001" / "god" / "decision.json"
        )
        assert god_path.exists(), f"god decision file missing at {god_path}"

        # ---- Universe.latest_metrics updated -----------------------------
        await db_session.refresh(
            await db_session.get(UniverseModel, seeded_universe["universe_id"])
        )
        uni = await db_session.get(UniverseModel, seeded_universe["universe_id"])
        assert uni.latest_metrics, "universe.latest_metrics should be populated"
        assert "active_cohorts" in uni.latest_metrics

        # ---- state_after.json present in ledger --------------------------
        state_after = (
            seeded_universe["ledger"].run_folder
            / "universes" / seeded_universe["universe_id"]
            / "ticks" / "tick_001" / "universe_state_after.json"
        )
        assert state_after.exists(), f"state_after missing at {state_after}"


# ---------------------------------------------------------------------------
# TestTickRunnerFrozen
# ---------------------------------------------------------------------------


class TestTickRunnerFrozen:
    """Universe.status == 'frozen' → run_tick returns early, no side effects."""

    async def test_frozen_universe_short_circuits(
        self,
        db_session,
        seeded_universe,
        rate_limiter,
        routing,
        patched_redis,
    ):
        from backend.app.models.cohorts import CohortStateModel
        from backend.app.models.universes import UniverseModel

        register_provider("openrouter", _RoutingProvider())

        # Flip status to frozen before invoking.
        uni = await db_session.get(UniverseModel, seeded_universe["universe_id"])
        uni.status = "frozen"
        uni.frozen_at = datetime.now(UTC)
        await db_session.commit()

        ctx = TickContext(
            run_id=seeded_universe["big_bang_id"],
            universe_id=seeded_universe["universe_id"],
            tick=1,
            attempt_number=1,
        )

        result = await run_tick_locally(
            ctx,
            session=db_session,
            ledger=seeded_universe["ledger"],
            routing=routing,
            limiter=rate_limiter,
            memory=None,
        )

        # Should short-circuit with universe_<status>.
        assert result["status"] == "universe_frozen", result

        # No tick=1 cohort_state rows should have been inserted.
        cs_q = select(CohortStateModel).where(
            CohortStateModel.universe_id == seeded_universe["universe_id"],
            CohortStateModel.tick == 1,
        )
        cs_rows = (await db_session.execute(cs_q)).scalars().all()
        assert len(cs_rows) == 0


# ---------------------------------------------------------------------------
# TestTickRunnerIdempotency
# ---------------------------------------------------------------------------


class TestTickRunnerIdempotency:
    """Two invocations with same key → second returns cached marker."""

    async def test_idempotent_second_call(
        self,
        db_session,
        seeded_universe,
        rate_limiter,
        routing,
        patched_redis,
    ):
        register_provider("openrouter", _RoutingProvider())

        ctx = TickContext(
            run_id=seeded_universe["big_bang_id"],
            universe_id=seeded_universe["universe_id"],
            tick=1,
            attempt_number=1,
        )

        result1 = await run_tick_locally(
            ctx,
            session=db_session,
            ledger=seeded_universe["ledger"],
            routing=routing,
            limiter=rate_limiter,
            memory=None,
        )
        assert result1["status"] == "completed"

        # Second invocation with same key.
        ctx2 = TickContext(
            run_id=seeded_universe["big_bang_id"],
            universe_id=seeded_universe["universe_id"],
            tick=1,
            attempt_number=1,
        )
        result2 = await run_tick_locally(
            ctx2,
            session=db_session,
            ledger=seeded_universe["ledger"],
            routing=routing,
            limiter=rate_limiter,
            memory=None,
        )
        assert result2["status"] == "already_running", result2


# ---------------------------------------------------------------------------
# TestTickRunnerSpawnActiveBranch
# ---------------------------------------------------------------------------


class TestTickRunnerSpawnActiveBranch:
    """God returns spawn_active w/ delta → branch_universe envelope enqueued."""

    async def test_branch_dispatch(
        self,
        db_session,
        seeded_universe,
        rate_limiter,
        routing,
        patched_redis,
        monkeypatch,
    ):
        captured: list[Any] = []

        async def _capture_enqueue(envelope, **kwargs):
            captured.append(envelope)
            return envelope.job_id

        # Patch the enqueue used by tick_runner via the workers.scheduler module.
        import backend.app.workers.scheduler as sched_mod
        monkeypatch.setattr(sched_mod, "enqueue", _capture_enqueue)

        # Provide a god decision that spawns active.
        register_provider(
            "openrouter",
            _RoutingProvider(
                god_payload=_canned_god_spawn_active(seeded_universe["event_id"]),
            ),
        )

        ctx = TickContext(
            run_id=seeded_universe["big_bang_id"],
            universe_id=seeded_universe["universe_id"],
            tick=1,
            attempt_number=1,
        )
        result = await run_tick_locally(
            ctx,
            session=db_session,
            ledger=seeded_universe["ledger"],
            routing=routing,
            limiter=rate_limiter,
            memory=None,
        )
        assert result["status"] == "completed", result

        # branch_universe envelope should be among the captured items.
        branch_envs = [e for e in captured if e.job_type == "branch_universe"]
        assert len(branch_envs) >= 1, (
            f"expected branch_universe enqueue, got types: "
            f"{[e.job_type for e in captured]}"
        )
        be = branch_envs[0]
        assert be.run_id == seeded_universe["big_bang_id"]
        assert be.universe_id == seeded_universe["universe_id"]
        assert be.payload.get("delta") is not None
        assert be.payload["delta"]["type"] == "counterfactual_event_rewrite"


__all__ = [
    "TestTickRunnerHappyPath",
    "TestTickRunnerFrozen",
    "TestTickRunnerIdempotency",
    "TestTickRunnerSpawnActiveBranch",
]
