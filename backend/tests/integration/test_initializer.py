"""Integration tests for backend.app.simulation.initializer.

Three test classes:

* :class:`TestInitializerHappyPath` — mocks ``call_with_policy`` to return a
  canned valid LLM payload (3 archetypes + 1 hero + 2 channels + 2 events).
  Verifies DB rows, ledger artifacts, and run-folder structure.

* :class:`TestInitializerInvalidOutput` — provider returns a malformed JSON
  body, expects :class:`InitializerValidationError` and ``status="failed"``.

* :class:`TestInitializerMemoryDisabled` — confirms init still completes when
  ``ZepConfig.enabled=False`` (LocalMemoryProvider is used as fallback).

A fourth test (``test_initializer_live_openrouter``) is marked
``@pytest.mark.live_openrouter`` and is opt-in — runs against the real
OpenRouter API with a tiny scenario.

Tests use the shared SQLite-in-memory ``db_session`` fixture from
``tests/integration/conftest.py`` (which patches JSONB/ARRAY → JSON).
"""
from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

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
from backend.app.simulation.errors import (
    InitializerValidationError,
)
from backend.app.simulation.initializer import (
    InitializerInput,
    initialize_big_bang,
)

pytestmark = [pytest.mark.asyncio]


# ---------------------------------------------------------------------------
# Canned LLM payload (3 archetypes + 1 hero + 2 channels + 2 events)
# ---------------------------------------------------------------------------


def _canned_initializer_payload() -> dict:
    return {
        "scenario_summary": (
            "A small Bay Area town debates whether to add a dedicated bus "
            "lane on its main commercial street. The proposal has split "
            "merchants, daily commuters, and transit advocates."
        ),
        "archetypes": [
            {
                "id": "arch_merchants",
                "label": "Main-Street Merchants",
                "description": "Small business owners who fear losing curb parking.",
                "population_total": 320,
                "geography": {"region_label": "Main Street", "scope": "neighborhood"},
                "issue_exposure": 0.85,
                "material_stake": 0.9,
                "symbolic_stake": 0.6,
                "vulnerability_to_policy": 0.7,
                "ability_to_influence_outcome": 0.5,
                "ideology_axes": {"economic": 0.6, "institutional_trust": 0.1},
                "value_priors": {},
                "behavior_axes": {"protest_propensity": 0.4},
                "baseline_media_diet": {"local_news": 0.8},
                "preferred_channels": ["local_news"],
                "platform_access": {"twitter": 0.5},
                "attention_capacity": 0.7,
                "attention_decay_rate": 0.18,
                "baseline_trust_priors": {"city_council": 0.2},
                "identity_tags": ["merchant", "main_street"],
                "ingroup_affinities": {"merchants": 0.8},
                "outgroup_distances": {"transit_advocates": 0.4},
                "allowed_action_classes": ["read", "social", "event_minor"],
                "coordination_capacity": 0.55,
                "mobilization_capacity": 0.5,
                "legal_or_status_risk_sensitivity": 0.6,
                "min_split_population": 25,
                "min_split_share": 0.1,
                "max_child_cohorts": 4,
            },
            {
                "id": "arch_commuters",
                "label": "Daily Commuters",
                "description": "Workers who use the bus every day.",
                "population_total": 4_500,
                "geography": {"region_label": "City Metro", "scope": "metro"},
                "issue_exposure": 0.6,
                "material_stake": 0.55,
                "symbolic_stake": 0.3,
                "vulnerability_to_policy": 0.5,
                "ability_to_influence_outcome": 0.3,
                "ideology_axes": {"economic": -0.1, "institutional_trust": 0.0},
                "value_priors": {},
                "behavior_axes": {"public_engagement": 0.5},
                "baseline_media_diet": {"local_news": 0.6, "twitter": 0.4},
                "preferred_channels": ["twitter"],
                "platform_access": {"twitter": 0.7},
                "attention_capacity": 0.5,
                "attention_decay_rate": 0.2,
                "baseline_trust_priors": {"city_council": 0.4},
                "identity_tags": ["commuter"],
                "ingroup_affinities": {"commuters": 0.6},
                "outgroup_distances": {},
                "allowed_action_classes": ["read", "social"],
                "coordination_capacity": 0.4,
                "mobilization_capacity": 0.4,
                "legal_or_status_risk_sensitivity": 0.4,
                "min_split_population": 50,
                "min_split_share": 0.1,
                "max_child_cohorts": 4,
            },
            {
                "id": "arch_advocates",
                "label": "Transit Advocates",
                "description": "Organised pro-transit volunteers.",
                "population_total": 180,
                "geography": {"region_label": "City", "scope": "city"},
                "issue_exposure": 0.95,
                "material_stake": 0.4,
                "symbolic_stake": 0.85,
                "vulnerability_to_policy": 0.2,
                "ability_to_influence_outcome": 0.6,
                "ideology_axes": {"economic": -0.3, "cultural": 0.5, "institutional_trust": 0.6},
                "value_priors": {},
                "behavior_axes": {"protest_propensity": 0.7, "public_engagement": 0.8},
                "baseline_media_diet": {"local_news": 0.5, "twitter": 0.5},
                "preferred_channels": ["twitter", "local_news"],
                "platform_access": {"twitter": 0.9},
                "attention_capacity": 0.85,
                "attention_decay_rate": 0.1,
                "baseline_trust_priors": {"transit_advocates": 0.9},
                "identity_tags": ["advocate", "transit"],
                "ingroup_affinities": {"advocates": 0.95},
                "outgroup_distances": {"merchants": 0.4},
                "allowed_action_classes": ["read", "social", "event_minor", "group"],
                "coordination_capacity": 0.8,
                "mobilization_capacity": 0.75,
                "legal_or_status_risk_sensitivity": 0.3,
                "min_split_population": 25,
                "min_split_share": 0.15,
                "max_child_cohorts": 3,
            },
        ],
        "heroes": [
            {
                "id": "hero_mayor",
                "label": "Mayor Alex Chen",
                "description": "Two-term mayor known for cautious centrism.",
                "role": "mayor",
                "institution": "city_hall",
                "location_scope": "city",
                "public_reach": 0.7,
                "institutional_power": 0.85,
                "financial_power": 0.4,
                "agenda_control": 0.75,
                "media_access": 0.6,
                "ideology_axes": {"economic": 0.0, "institutional_trust": 0.5},
                "value_priors": {},
                "trust_priors": {"city_council": 0.7},
                "behavioral_axes": {"strategic_caution": 0.7},
                "volatility": 0.2,
                "ego_sensitivity": 0.4,
                "strategic_discipline": 0.75,
                "controversy_tolerance": 0.4,
                "direct_event_power": 0.7,
                "scheduling_permissions": ["press_conference", "public_meeting"],
                "allowed_channels": ["press_release", "local_news"],
            },
        ],
        "channels": [
            {
                "id": "ch_local_news",
                "type": "newspaper_local",
                "label": "Town Daily",
                "description": "Local newspaper of record.",
                "audience_size": 8000,
                "credibility_prior": 0.7,
                "bias_overrides": {"economic": 0.0},
            },
            {
                "id": "ch_twitter_local",
                "type": "social_microblog",
                "label": "Town Twitter Cluster",
                "audience_size": 12000,
                "credibility_prior": 0.4,
            },
        ],
        "initial_events": [
            {
                "event_type": "policy_announcement",
                "title": "Bus-lane proposal published",
                "description": "City Hall publishes the formal bus-lane proposal.",
                "scheduled_tick": 0,
                "duration_ticks": 1,
                "created_by_actor_id": "hero_mayor",
                "participants": ["hero_mayor"],
                "target_audience": ["arch_merchants", "arch_commuters", "arch_advocates"],
                "visibility": "public",
                "risk_level": 0.1,
                "expected_effects": {"attention_boost": 0.3},
            },
            {
                "event_type": "public_meeting",
                "title": "Town hall on the proposal",
                "description": "Town hall meeting open to all residents.",
                "scheduled_tick": 2,
                "duration_ticks": 1,
                "created_by_actor_id": "hero_mayor",
                "participants": ["hero_mayor"],
                "target_audience": ["arch_merchants", "arch_commuters", "arch_advocates"],
                "visibility": "public",
                "risk_level": 0.2,
                "expected_effects": {},
            },
        ],
    }


# ---------------------------------------------------------------------------
# Mock provider — returns a canned LLMResult
# ---------------------------------------------------------------------------


class _CannedProvider(BaseProvider):
    """Mock provider that returns one canned LLMResult per call."""

    def __init__(self, parsed_json: dict | None, *, raise_invalid_json: bool = False) -> None:
        self.name = "openrouter"
        self._parsed = parsed_json
        self._raise_invalid_json = raise_invalid_json
        self.calls: int = 0

    async def generate_structured(self, prompt, config):
        self.calls += 1
        if self._raise_invalid_json:
            from backend.app.providers.errors import InvalidJSONError
            raise InvalidJSONError("mock provider returned malformed JSON")
        return LLMResult(
            call_id=self._make_call_id("mock"),
            provider=self.name,
            model_used=config.model,
            prompt_tokens=200,
            completion_tokens=800,
            total_tokens=1000,
            cost_usd=0.005,
            latency_ms=120,
            parsed_json=self._parsed,
            tool_calls=[],
            raw_response={"id": "mock-resp", "model": config.model},
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
async def redis_client():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
def rate_limiter(redis_client) -> ProviderRateLimiter:
    return ProviderRateLimiter(
        redis_client,
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


@pytest.fixture
def initializer_input() -> InitializerInput:
    return InitializerInput(
        scenario_text=(
            "A small Bay Area town debates a new dedicated bus lane on its "
            "main commercial street. Merchants worry about parking. "
            "Commuters and transit advocates push back."
        ),
        display_name="Bus Lane Test",
        uploaded_docs=[
            {
                "name": "proposal.txt",
                "content_text": "Draft bus-lane proposal v1: a dedicated lane on Main Street.",
                "content_type": "text/plain",
                "summary": "Draft proposal for a dedicated bus lane.",
                "excerpt": "Draft bus-lane proposal v1: a dedicated lane on Main Street.",
            }
        ],
        time_horizon_label="1 month",
        tick_duration_minutes=60,
        max_ticks=10,
        max_schedule_horizon_ticks=5,
        provider_snapshot_id="provsnap-test",
        created_by_user_id="user-test",
    )


# ---------------------------------------------------------------------------
# TestInitializerHappyPath
# ---------------------------------------------------------------------------


class TestInitializerHappyPath:
    """Mock provider returns a canned valid payload — verifies DB + ledger."""

    async def test_initializer_full_happy_path(
        self,
        db_session,
        rate_limiter,
        routing,
        initializer_input,
        tmp_path,
    ):
        # Register canned provider so call_with_policy hits it.
        register_provider("openrouter", _CannedProvider(_canned_initializer_payload()))

        result = await initialize_big_bang(
            initializer_input,
            session=db_session,
            sot=None,
            provider_rate_limiter=rate_limiter,
            run_root=tmp_path,
            routing=routing,
        )

        # --- Result shape ---------------------------------------------
        assert result.big_bang_run.status == "running"
        assert result.root_universe.status == "active"
        assert result.root_universe.branch_depth == 0
        assert result.root_universe.lineage_path == [result.root_universe.universe_id]
        assert len(result.archetypes) == 3
        assert len(result.initial_cohort_states) == 3
        assert len(result.heroes) == 1
        assert len(result.initial_hero_states) == 1
        assert len(result.initial_events) == 2
        assert len(result.channels) == 2
        summary_lower = result.scenario_summary.lower()
        assert "bay area" in summary_lower or "bus lane" in summary_lower

        # --- Cohort state defaults ------------------------------------
        for cohort in result.initial_cohort_states:
            assert cohort.tick == 0
            assert cohort.universe_id == result.root_universe.universe_id
            assert cohort.is_active is True
            # represented_population must equal archetype.population_total
            arch = next(a for a in result.archetypes if a.archetype_id == cohort.archetype_id)
            assert cohort.represented_population == arch.population_total
            assert 0 < cohort.represented_population
            # PRD §11.3 — population_share_of_archetype == 1.0 for the seed cohort
            assert cohort.population_share_of_archetype == 1.0

        # --- Initial events at tick 0 ---------------------------------
        for ev in result.initial_events:
            assert ev.created_tick == 0
            assert ev.status == "scheduled"
            assert ev.universe_id == result.root_universe.universe_id

        # --- Run folder + ledger artifacts ----------------------------
        run_folder = result.run_folder
        assert run_folder.exists()
        assert (run_folder / "manifest.json").exists()
        assert (run_folder / "config" / "config_snapshot.json").exists()
        sot_snapshot_dir = run_folder / "source_of_truth_snapshot"
        assert sot_snapshot_dir.exists()
        assert (sot_snapshot_dir / "VERSION").exists()
        assert (run_folder / "input" / "original_prompt.md").exists()
        assert (run_folder / "input" / "uploaded_docs" / "proposal.txt").exists()
        assert (run_folder / "input" / "scenario_material.json").exists()
        assert (run_folder / "initialization" / "initializer_prompt.md").exists()
        assert (run_folder / "initialization" / "initializer_response_raw.json").exists()
        assert (run_folder / "initialization" / "initializer_response_parsed.json").exists()
        assert (run_folder / "initialization" / "validation_report.json").exists()
        # Universe folder + manifest
        uni_folder = run_folder / "universes" / result.root_universe.universe_id
        assert uni_folder.exists()
        assert (uni_folder / "manifest.json").exists()

        # validation_report ok flag
        report = json.loads((run_folder / "initialization" / "validation_report.json").read_bytes())
        assert report["ok"] is True
        assert report["archetype_count"] == 3
        assert report["hero_count"] == 1
        assert report["initial_event_count"] == 2

        # --- DB rows --------------------------------------------------
        from backend.app.models.cohorts import (
            CohortStateModel,
            PopulationArchetypeModel,
        )
        from backend.app.models.events import EventModel
        from backend.app.models.heroes import HeroArchetypeModel, HeroStateModel
        from backend.app.models.runs import BigBangRunModel
        from backend.app.models.universes import UniverseModel

        run_row = (
            await db_session.execute(
                select(BigBangRunModel).where(
                    BigBangRunModel.big_bang_id == result.big_bang_run.big_bang_id
                )
            )
        ).scalar_one()
        assert run_row.status == "running"

        uni_rows = (
            await db_session.execute(
                select(UniverseModel).where(
                    UniverseModel.big_bang_id == result.big_bang_run.big_bang_id
                )
            )
        ).scalars().all()
        assert len(uni_rows) == 1
        assert uni_rows[0].universe_id == result.root_universe.universe_id
        assert uni_rows[0].lineage_path == [result.root_universe.universe_id]
        assert uni_rows[0].branch_depth == 0
        assert uni_rows[0].status == "active"

        arch_rows = (
            await db_session.execute(
                select(PopulationArchetypeModel).where(
                    PopulationArchetypeModel.big_bang_id == result.big_bang_run.big_bang_id
                )
            )
        ).scalars().all()
        assert len(arch_rows) == 3

        cohort_rows = (
            await db_session.execute(
                select(CohortStateModel).where(
                    CohortStateModel.universe_id == result.root_universe.universe_id
                )
            )
        ).scalars().all()
        assert len(cohort_rows) == 3
        assert all(c.tick == 0 for c in cohort_rows)
        # represented_population per cohort matches archetype.population_total
        cohort_pop_by_arch = {c.archetype_id: c.represented_population for c in cohort_rows}
        arch_pop_by_id = {a.archetype_id: a.population_total for a in arch_rows}
        for arch_id, expected_pop in arch_pop_by_id.items():
            assert cohort_pop_by_arch[arch_id] == expected_pop

        hero_rows = (
            await db_session.execute(
                select(HeroArchetypeModel).where(
                    HeroArchetypeModel.big_bang_id == result.big_bang_run.big_bang_id
                )
            )
        ).scalars().all()
        assert len(hero_rows) == 1

        hero_state_rows = (
            await db_session.execute(
                select(HeroStateModel).where(
                    HeroStateModel.universe_id == result.root_universe.universe_id
                )
            )
        ).scalars().all()
        assert len(hero_state_rows) == 1
        assert hero_state_rows[0].tick == 0

        event_rows = (
            await db_session.execute(
                select(EventModel).where(
                    EventModel.universe_id == result.root_universe.universe_id
                )
            )
        ).scalars().all()
        assert len(event_rows) == 2
        assert all(e.created_tick == 0 for e in event_rows)
        assert all(e.status == "scheduled" for e in event_rows)


# ---------------------------------------------------------------------------
# TestInitializerInvalidOutput
# ---------------------------------------------------------------------------


class TestInitializerInvalidOutput:
    """Provider returns a malformed payload — initializer raises and marks failed."""

    async def test_invalid_shape_raises_validation_error(
        self,
        db_session,
        rate_limiter,
        routing,
        initializer_input,
        tmp_path,
    ):
        # Register a provider that returns a structurally invalid payload —
        # missing 'archetypes', 'heroes', etc.
        bad_payload = {"oops": "this is not initializer output"}
        register_provider("openrouter", _CannedProvider(bad_payload))

        with pytest.raises(InitializerValidationError):
            await initialize_big_bang(
                initializer_input,
                session=db_session,
                sot=None,
                provider_rate_limiter=rate_limiter,
                run_root=tmp_path,
                routing=routing,
            )

        # BigBangRun row should be marked failed.
        from backend.app.models.runs import BigBangRunModel

        rows = (
            await db_session.execute(select(BigBangRunModel))
        ).scalars().all()
        # We may have inserted exactly one failed row.
        assert len(rows) >= 1
        failed_rows = [r for r in rows if r.status == "failed"]
        statuses = [r.status for r in rows]
        assert len(failed_rows) >= 1, f"expected at least one failed row, got: {statuses}"

        # validation_report.json must exist with ok=False.
        # Find the run folder via the failed row.
        failed_row = failed_rows[-1]
        report_path = Path(failed_row.run_folder_path) / "initialization" / "validation_report.json"
        assert report_path.exists()
        report = json.loads(report_path.read_bytes())
        assert report["ok"] is False
        assert "error" in report

    async def test_empty_parsed_json_raises_validation_error(
        self,
        db_session,
        rate_limiter,
        routing,
        initializer_input,
        tmp_path,
    ):
        # Provider returns parsed_json=None — should raise
        # InitializerValidationError with 'invalid JSON' message.
        register_provider("openrouter", _CannedProvider(parsed_json=None))

        with pytest.raises(InitializerValidationError) as exc_info:
            await initialize_big_bang(
                initializer_input,
                session=db_session,
                sot=None,
                provider_rate_limiter=rate_limiter,
                run_root=tmp_path,
                routing=routing,
            )
        # parsed_json=None falls through ToolParser which expects a dict;
        # we surface a plain "invalid JSON" message in this path.
        msg = str(exc_info.value).lower()
        assert "invalid" in msg or "validation" in msg


# ---------------------------------------------------------------------------
# TestInitializerMemoryDisabled
# ---------------------------------------------------------------------------


class TestInitializerMemoryDisabled:
    """With ZepConfig.enabled=False, init still completes (LocalMemoryProvider)."""

    async def test_init_succeeds_without_zep(
        self,
        db_session,
        rate_limiter,
        routing,
        initializer_input,
        tmp_path,
        monkeypatch,
    ):
        # Force the memory factory to return LocalMemoryProvider.
        monkeypatch.delenv("ZEP_API_KEY", raising=False)
        from backend.app.memory import factory as memfactory
        from backend.app.memory.local import LocalMemoryProvider

        # Reset cached singleton to ensure rebuild.
        memfactory._provider_singleton = None  # type: ignore[attr-defined]

        # Patch get_memory to always return LocalMemoryProvider.
        local_provider = LocalMemoryProvider()
        monkeypatch.setattr(memfactory, "get_memory", lambda: local_provider)

        register_provider("openrouter", _CannedProvider(_canned_initializer_payload()))

        result = await initialize_big_bang(
            initializer_input,
            session=db_session,
            sot=None,
            provider_rate_limiter=rate_limiter,
            run_root=tmp_path,
            routing=routing,
        )

        assert result.big_bang_run.status == "running"
        # Memory should have one user per cohort + one per hero.
        health = await local_provider.healthcheck()
        # 3 cohorts + 1 hero = 4 users.
        assert health["details"]["users"] == 4
        # 3 cohort sessions + 1 hero session = 4 sessions.
        assert health["details"]["sessions"] == 4


# ---------------------------------------------------------------------------
# Live OpenRouter test — opt-in
# ---------------------------------------------------------------------------


@pytest.mark.live_openrouter
async def test_initializer_live_openrouter(
    db_session,
    rate_limiter,
    routing,
    tmp_path,
):
    """One real OpenRouter call against a tiny scenario.

    Skipped by default. Run with::

        pytest -m live_openrouter backend/tests/integration/test_initializer.py
    """
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        pytest.skip("OPENROUTER_API_KEY not set — skipping live initializer test")

    # Register the real OpenRouter provider with a small fast model.
    from backend.app.providers.openrouter import OpenRouterProvider

    register_provider(
        "openrouter",
        OpenRouterProvider(
            api_key=api_key,
            base_url=os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            default_model="openai/gpt-4o-mini",
            fallback_model="openai/gpt-4o-mini",
            http_referer="http://localhost:3003",
            x_title="WorldFork-tests",
        ),
    )

    # Build a routing table that uses gpt-4o-mini for the initializer too.
    from backend.app.schemas.settings import ModelRoutingEntry

    live_routing = RoutingTable(
        {
            "initialize_big_bang": ModelRoutingEntry(
                job_type="initialize_big_bang",
                preferred_provider="openrouter",
                preferred_model="openai/gpt-4o-mini",
                fallback_provider="openrouter",
                fallback_model="openai/gpt-4o-mini",
                temperature=0.6,
                top_p=0.95,
                max_tokens=4096,
                max_concurrency=2,
                requests_per_minute=20,
                tokens_per_minute=200_000,
                timeout_seconds=120,
                retry_policy="exponential_backoff",
                daily_budget_usd=None,
            )
        }
    )

    init_input = InitializerInput(
        scenario_text="A small town debates a new bus lane on its main street.",
        display_name="Live Bus Lane Test",
        uploaded_docs=[],
        time_horizon_label="1 day",
        tick_duration_minutes=60,
        max_ticks=3,
        max_schedule_horizon_ticks=2,
    )

    result = await initialize_big_bang(
        init_input,
        session=db_session,
        sot=None,
        provider_rate_limiter=rate_limiter,
        run_root=tmp_path,
        routing=live_routing,
    )

    # Real-world checks — the LLM should produce at least 2 archetypes and 1+ event.
    assert result.big_bang_run.status == "running"
    assert len(result.archetypes) >= 2
    assert len(result.initial_events) >= 1

    # Verify the LLMCallModel row carries cost / token usage.
    from backend.app.models.llm_calls import LLMCallModel

    call_rows = (
        await db_session.execute(select(LLMCallModel))
    ).scalars().all()
    # call_with_policy persists the call to the ledger; the DB row write
    # for llm_calls is part of B5 batch and not done here directly, so
    # we accept either an empty list or a populated one. If populated,
    # check the cost/token fields.
    if call_rows:
        row = call_rows[-1]
        assert row.total_tokens > 0
        # cost_usd may be None for free-tier models; just check it parses
        # if present.
        if row.cost_usd is not None:
            assert float(row.cost_usd) >= 0
