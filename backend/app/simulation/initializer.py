"""Big Bang initializer — turns scenario text into a populated root universe.

Implements PRD §11.1's "tick 0" preface: takes the user-supplied scenario
text + optional uploaded reference docs + run config, calls the LLM through
``call_with_policy(job_type='initialize_big_bang', ...)`` once, validates the
response against ``initializer_schema.json``, and persists everything to:

  * The database (BigBangRun, root Universe, archetypes, cohort_states at
    tick 0, hero_archetypes, hero_states at tick 0, scheduled events).
  * The run ledger (manifest, config snapshot, SoT snapshot, input docs,
    initializer prompt + raw + parsed responses, validation report).
  * The memory provider (one user + session per cohort/hero).

This is the first real LLM call of the system.  It is meant to be fast
(< 60s with gpt-4o-mini) and idempotent at the run-folder level (the ledger
refuses overwrites of immutable artifacts).

Public API:
    :func:`initialize_big_bang`
    :class:`InitializerInput`
    :class:`InitializerResult`
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.clock import now_utc
from backend.app.core.ids import new_id
from backend.app.providers import call_with_policy
from backend.app.providers.rate_limits import ProviderRateLimiter
from backend.app.providers.routing import RoutingTable
from backend.app.schemas.actors import (
    CohortState,
    HeroArchetype,
    HeroState,
    PopulationArchetype,
)
from backend.app.schemas.branching import BranchPolicy
from backend.app.schemas.events import Event
from backend.app.schemas.settings import (
    ProviderConfig,
    RateLimitConfig,
)
from backend.app.schemas.universes import BigBangRun, Universe
from backend.app.simulation.errors import (
    InitializerProviderError,
    InitializerValidationError,
)
from backend.app.simulation.prompt_builder import PromptBuilder
from backend.app.simulation.scenario_seeder import (
    derive_default_emotions,
    derive_default_issue_stance,
    derive_initial_expression,
    derive_initial_modes,
    derive_prompt_temperature,
    derive_representation_mode,
)
from backend.app.simulation.tool_parser import ToolParseError, ToolParser
from backend.app.storage.artifacts import (
    write_llm_call,  # noqa: F401  (used indirectly via persist_call)
)
from backend.app.storage.ledger import Ledger
from backend.app.storage.sot_loader import SoTBundle, load_sot, snapshot_sot_to

if TYPE_CHECKING:
    from backend.app.memory.base import MemoryProvider

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------


@dataclass
class InitializerInput:
    """All data the initializer needs from the API / wizard.

    Mirrors the §20.1 ``POST /api/runs`` body plus the operator-defined
    horizon and tick-loop knobs.
    """

    scenario_text: str
    display_name: str
    uploaded_docs: list[dict] = field(default_factory=list)
    """List of ``{'name', 'content_text', 'content_type'}`` dicts."""

    time_horizon_label: str = "1 month"
    tick_duration_minutes: int = 60
    max_ticks: int = 30
    max_schedule_horizon_ticks: int = 5
    provider_snapshot_id: str | None = None
    created_by_user_id: str | None = None
    big_bang_id: str | None = None
    root_universe_id: str | None = None


@dataclass
class InitializerResult:
    """Everything the caller needs to navigate the freshly-created run.

    All fields are *schemas* (Pydantic models), not ORM rows, so they are
    safe to serialise across thread / Celery boundaries.
    """

    big_bang_run: BigBangRun
    root_universe: Universe
    archetypes: list[PopulationArchetype]
    initial_cohort_states: list[CohortState]
    heroes: list[HeroArchetype]
    initial_hero_states: list[HeroState]
    initial_events: list[Event]
    channels: list[dict]
    run_folder: Path
    sot_snapshot_path: str
    scenario_summary: str = ""


# ---------------------------------------------------------------------------
# Helpers — config snapshot
# ---------------------------------------------------------------------------


def _build_config_snapshot(
    *,
    sot: SoTBundle,
    input: InitializerInput,
    routing: RoutingTable,
) -> dict:
    """Assemble the §19 ``config_snapshot.json`` payload.

    Pulls defaults from ``sociology_parameters.json`` so the run records the
    exact branch / rate-limit / provider posture in effect at Big Bang time.
    """
    soc = sot.sociology_parameters or {}
    branch_defaults = soc.get("branching_defaults", {})

    branch_policy = BranchPolicy(
        max_active_universes=int(branch_defaults.get("max_active_universes", 50)),
        max_total_branches=int(branch_defaults.get("max_total_branches", 500)),
        max_depth=int(branch_defaults.get("max_depth", 8)),
        max_branches_per_tick=int(branch_defaults.get("max_branches_per_tick", 5)),
        branch_cooldown_ticks=int(branch_defaults.get("branch_cooldown_ticks", 3)),
        min_divergence_score=float(branch_defaults.get("min_divergence_score", 0.35)),
        auto_prune_low_value=bool(branch_defaults.get("auto_prune_low_value", True)),
    )

    provider_config = ProviderConfig(
        provider="openrouter",
        base_url=os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        api_key_env="OPENROUTER_API_KEY",
        default_model=os.environ.get("DEFAULT_MODEL", "deepseek/deepseek-v3.2"),
        fallback_model=os.environ.get("FALLBACK_MODEL", "openai/gpt-4o-mini"),
    )

    rate_limit = RateLimitConfig(
        provider="openrouter",
        rpm_limit=600,
        tpm_limit=1_000_000,
        max_concurrency=8,
        burst_multiplier=1.2,
        retry_policy="exponential_backoff",
        branch_reserved_capacity_pct=20.0,
    )

    return {
        "sot_version": sot.version,
        "sot_snapshot_sha256": sot.snapshot_sha256,
        "scenario_text_excerpt": (input.scenario_text[:240] + "...")
        if len(input.scenario_text) > 240
        else input.scenario_text,
        "time_horizon_label": input.time_horizon_label,
        "tick_duration_minutes": input.tick_duration_minutes,
        "max_ticks": input.max_ticks,
        "max_schedule_horizon_ticks": input.max_schedule_horizon_ticks,
        "branch_policy": branch_policy.model_dump(mode="json"),
        "provider_config": provider_config.model_dump(mode="json"),
        "rate_limit": rate_limit.model_dump(mode="json"),
        "model_routing": _routing_table_summary(routing),
        "uploaded_doc_names": [d.get("name", "") for d in input.uploaded_docs],
    }


def _routing_table_summary(routing: RoutingTable) -> dict:
    """Best-effort dump of the routing table for the config snapshot."""
    out: dict[str, Any] = {}
    entries = getattr(routing, "_entries", {}) or {}
    for job_type, entry in entries.items():
        try:
            out[str(job_type)] = entry.model_dump(mode="json")
        except Exception:
            out[str(job_type)] = {
                "preferred_provider": getattr(entry, "preferred_provider", None),
                "preferred_model": getattr(entry, "preferred_model", None),
            }
    return out


# ---------------------------------------------------------------------------
# Helpers — input persistence
# ---------------------------------------------------------------------------


def _persist_inputs(ledger: Ledger, input: InitializerInput) -> list[str]:
    """Write the scenario + uploaded docs into ``runs/.../input/``.

    Returns the list of input_file_ids we want to attach to BigBangRun.
    """
    file_ids: list[str] = []
    ledger.write_artifact(
        "input/original_prompt.md", input.scenario_text, immutable=True
    )
    for idx, doc in enumerate(input.uploaded_docs):
        name = str(doc.get("name") or f"doc_{idx:03d}.txt")
        # Sanitize filename — keep only basename, no path components.
        safe_name = os.path.basename(name).replace("/", "_") or f"doc_{idx:03d}.txt"
        rel = f"input/uploaded_docs/{safe_name}"
        body = doc.get("content_text") or ""
        ledger.write_artifact(rel, body, immutable=True)
        file_ids.append(safe_name)

    scenario_meta = {
        "display_name": input.display_name,
        "time_horizon_label": input.time_horizon_label,
        "tick_duration_minutes": input.tick_duration_minutes,
        "max_ticks": input.max_ticks,
        "max_schedule_horizon_ticks": input.max_schedule_horizon_ticks,
        "uploaded_doc_count": len(input.uploaded_docs),
        "created_by_user_id": input.created_by_user_id,
    }
    ledger.write_artifact("input/scenario_material.json", scenario_meta, immutable=True)

    return file_ids


# ---------------------------------------------------------------------------
# Helpers — output validation
# ---------------------------------------------------------------------------

# PRD §9.3 required fields on the *Pydantic* PopulationArchetype (after our
# JSON-key→python-key mapping below).
_REQUIRED_ARCHETYPE_FIELDS: tuple[str, ...] = (
    "archetype_id",
    "label",
    "description",
    "population_total",
)

_REQUIRED_HERO_FIELDS: tuple[str, ...] = (
    "hero_id",
    "label",
    "description",
    "role",
)


def _scoped_id(prefix: str, raw_id: str, big_bang_id: str) -> str:
    """Build a globally-unique ID by prefixing with the BigBang short suffix.

    The LLM produces stable IDs like ``arch_merchants``; multiple runs in the
    same DB would collide on the primary key. Namespace by appending the
    last 8 chars of the big_bang_id so the original semantic id is still
    visible in artifacts and DB rows.
    """
    bb_suffix = big_bang_id.split("_")[-1][-8:].lower()
    base = raw_id
    if base.startswith(prefix + "_"):
        base = base[len(prefix) + 1 :]
    return f"{prefix}_{base}_{bb_suffix}"


def _build_archetype(
    raw: dict, *, big_bang_id: str
) -> PopulationArchetype:
    """Convert the LLM JSON archetype shape (uses ``id``) to the Pydantic
    PopulationArchetype schema (uses ``archetype_id``).

    Raises :class:`InitializerValidationError` if anything is missing.
    """
    if "id" not in raw:
        raise InitializerValidationError(
            f"archetype missing 'id': {str(raw)[:200]}"
        )
    raw_id = str(raw["id"])
    archetype_id = _scoped_id("arch", raw_id, big_bang_id)

    pop_total_raw = raw.get("population_total")
    try:
        pop_total = int(pop_total_raw)
    except (TypeError, ValueError) as exc:
        raise InitializerValidationError(
            f"archetype {archetype_id!r}: population_total must be int, got {pop_total_raw!r}"
        ) from exc
    if pop_total <= 0:
        raise InitializerValidationError(
            f"archetype {archetype_id!r}: population_total must be > 0 (got {pop_total})"
        )

    payload = dict(raw)
    payload["archetype_id"] = archetype_id
    payload.pop("id", None)

    try:
        return PopulationArchetype(**payload)
    except Exception as exc:
        raise InitializerValidationError(
            f"archetype {archetype_id!r} failed schema validation: {exc}"
        ) from exc


def _build_hero(raw: dict, *, big_bang_id: str) -> HeroArchetype:
    """Convert LLM hero JSON (uses ``id``) to HeroArchetype Pydantic schema."""
    if "id" not in raw:
        raise InitializerValidationError(
            f"hero missing 'id': {str(raw)[:200]}"
        )
    raw_id = str(raw["id"])
    hero_id = _scoped_id("hero", raw_id, big_bang_id)

    payload = dict(raw)
    payload["hero_id"] = hero_id
    payload.pop("id", None)

    try:
        return HeroArchetype(**payload)
    except Exception as exc:
        raise InitializerValidationError(
            f"hero {hero_id!r} failed schema validation: {exc}"
        ) from exc


def _validate_required_fields(parsed: dict) -> None:
    """Top-level required-field sweep.

    The JSONSchema validator already ran via ToolParser.parse_initializer_output;
    this is a defensive belt-and-braces check that surfaces field-level errors
    with cohort-friendly messages.
    """
    if "archetypes" not in parsed:
        raise InitializerValidationError(
            "initializer output missing required key: 'archetypes'"
        )
    # heroes/channels/initial_events default to empty when omitted by the LLM.
    parsed.setdefault("heroes", [])
    parsed.setdefault("channels", [])
    parsed.setdefault("initial_events", [])

    archetypes = parsed["archetypes"]
    if not isinstance(archetypes, list) or len(archetypes) < 1:
        raise InitializerValidationError(
            f"archetypes must be a non-empty list (got {type(archetypes).__name__}, "
            f"len={len(archetypes) if hasattr(archetypes, '__len__') else 'n/a'})"
        )

    for i, arch in enumerate(archetypes):
        if not isinstance(arch, dict):
            raise InitializerValidationError(
                f"archetypes[{i}] is not a dict: {type(arch).__name__}"
            )
        # We accept either 'id' or 'archetype_id' — PRD §9.3 uses the latter,
        # the schema uses the former.
        if "id" not in arch and "archetype_id" not in arch:
            raise InitializerValidationError(
                f"archetypes[{i}] missing 'id' or 'archetype_id'"
            )
        for field_name in _REQUIRED_ARCHETYPE_FIELDS:
            if field_name == "archetype_id":
                continue   # handled above
            if field_name not in arch:
                raise InitializerValidationError(
                    f"archetypes[{i}] ({arch.get('id') or arch.get('archetype_id')!r}) "
                    f"missing required field: {field_name!r}"
                )

    for i, hero in enumerate(parsed["heroes"]):
        if not isinstance(hero, dict):
            raise InitializerValidationError(
                f"heroes[{i}] is not a dict: {type(hero).__name__}"
            )
        if "id" not in hero and "hero_id" not in hero:
            raise InitializerValidationError(
                f"heroes[{i}] missing 'id' or 'hero_id'"
            )
        for field_name in _REQUIRED_HERO_FIELDS:
            if field_name == "hero_id":
                continue
            if field_name not in hero:
                raise InitializerValidationError(
                    f"heroes[{i}] ({hero.get('id') or hero.get('hero_id')!r}) "
                    f"missing required field: {field_name!r}"
                )


# ---------------------------------------------------------------------------
# Helpers — DB persistence
# ---------------------------------------------------------------------------


def _seed_cohort_state(
    *,
    archetype: PopulationArchetype,
    universe_id: str,
    scenario_text: str,
) -> CohortState:
    """Build the single seed CohortState (tick=0) for ``archetype``."""
    expression = derive_initial_expression(archetype)
    mob_mode, speech_mode = derive_initial_modes(expression)

    return CohortState(
        cohort_id=new_id("coh"),
        universe_id=universe_id,
        tick=0,
        archetype_id=archetype.archetype_id,
        parent_cohort_id=None,
        child_cohort_ids=[],
        represented_population=archetype.population_total,
        population_share_of_archetype=1.0,
        issue_stance=derive_default_issue_stance(archetype, scenario_text),
        expression_level=expression,
        mobilization_mode=mob_mode,
        speech_mode=speech_mode,
        emotions=derive_default_emotions(archetype, scenario_text),
        behavior_state=dict(archetype.behavior_axes),
        attention=archetype.attention_capacity,
        fatigue=0.0,
        grievance=archetype.material_stake * 0.5,
        perceived_efficacy=archetype.ability_to_influence_outcome,
        perceived_majority={},
        fear_of_isolation=0.0,
        willingness_to_speak=0.5 + (expression - 0.5) * 0.5,
        identity_salience=0.5,
        visible_trust_summary={},
        exposure_summary={},
        dependency_summary={},
        memory_session_id=None,
        recent_post_ids=[],
        queued_event_ids=[],
        previous_action_ids=[],
        prompt_temperature=derive_prompt_temperature(archetype.population_total),
        representation_mode=derive_representation_mode(archetype.population_total),
        allowed_tools=[],
        is_active=True,
    )


def _seed_hero_state(*, hero: HeroArchetype, universe_id: str) -> HeroState:
    """Build the initial HeroState (tick=0) for a hero archetype."""
    return HeroState(
        hero_id=hero.hero_id,
        universe_id=universe_id,
        tick=0,
        current_emotions={},
        current_issue_stances={"primary_issue": 0.0},
        attention=0.6,
        fatigue=0.0,
        perceived_pressure=0.3,
        current_strategy="",
        queued_events=[],
        recent_posts=[],
        memory_session_id=None,
    )


def _build_event(
    raw: dict,
    *,
    universe_id: str,
    max_tick: int,
) -> Event:
    """Convert an InitialEvent dict to a domain :class:`Event` schema."""
    scheduled_tick = int(raw.get("scheduled_tick", 0))
    # Clamp scheduled_tick into the run horizon — initial events should not
    # be scheduled past the simulation's max_tick.
    scheduled_tick = max(0, min(scheduled_tick, max(max_tick - 1, 0)))

    # Visibility sometimes uses 'institution' vs 'public/private/internal'
    # in the schema; map 'internal' to 'institution' which is in the
    # domain enum (§9.7).
    raw_visibility = str(raw.get("visibility", "public") or "public")
    visibility_map = {
        "internal": "institution",
        "public": "public",
        "private": "private",
        "institution": "institution",
        "cohort": "cohort",
        "invite": "invite",
    }
    visibility = visibility_map.get(raw_visibility, "public")

    return Event(
        event_id=new_id("evt"),
        universe_id=universe_id,
        created_tick=0,
        scheduled_tick=scheduled_tick,
        duration_ticks=int(raw.get("duration_ticks") or 1),
        event_type=str(raw.get("event_type", "background_event")),
        title=str(raw.get("title", "Initial event")),
        description=str(raw.get("description", "")),
        created_by_actor_id=str(raw.get("created_by_actor_id") or "initializer"),
        participants=list(raw.get("participants") or []),
        target_audience=list(raw.get("target_audience") or []),
        visibility=visibility,
        preconditions=[],
        expected_effects=dict(raw.get("expected_effects") or {}),
        actual_effects=None,
        risk_level=float(raw.get("risk_level", 0.2)),
        status="scheduled",
        parent_event_id=None,
        source_llm_call_id=None,
    )


# ---------------------------------------------------------------------------
# Memory bootstrap
# ---------------------------------------------------------------------------


async def _bootstrap_memory(
    *,
    cohort_states: list[CohortState],
    hero_states: list[HeroState],
    archetypes: list[PopulationArchetype],
    heroes: list[HeroArchetype],
    root_universe_id: str,
    big_bang_id: str,
) -> None:
    """Create one memory user + session per cohort + hero.

    Soft-fails — if the memory provider is unhealthy, log a warning and
    continue.  Per PRD §17.7 the run ledger is the canonical store; Zep is
    secondary.
    """
    try:
        from backend.app.memory.factory import get_memory
    except Exception as exc:
        _log.warning("memory factory unavailable: %s; skipping bootstrap", exc)
        return

    try:
        memory: MemoryProvider = get_memory()
    except Exception as exc:
        _log.warning("memory provider construction failed: %s; skipping", exc)
        return

    arch_by_id = {a.archetype_id: a for a in archetypes}
    hero_by_id = {h.hero_id: h for h in heroes}

    for cohort in cohort_states:
        actor_id = cohort.cohort_id
        archetype = arch_by_id.get(cohort.archetype_id)
        try:
            await memory.ensure_user(
                actor_id=actor_id,
                actor_kind="cohort",
                metadata={
                    "archetype_id": cohort.archetype_id,
                    "label": archetype.label if archetype else "",
                    "big_bang_id": big_bang_id,
                    "represented_population": cohort.represented_population,
                },
            )
            await memory.ensure_session(
                actor_id=actor_id,
                universe_id=root_universe_id,
                metadata={
                    "tick": 0,
                    "big_bang_id": big_bang_id,
                    "kind": "cohort_session",
                },
            )
        except Exception as exc:
            _log.warning(
                "memory bootstrap failed for cohort %s: %s; continuing",
                actor_id, exc,
            )

    for hs in hero_states:
        actor_id = hs.hero_id
        hero = hero_by_id.get(actor_id)
        try:
            await memory.ensure_user(
                actor_id=actor_id,
                actor_kind="hero",
                metadata={
                    "label": hero.label if hero else "",
                    "role": hero.role if hero else "",
                    "big_bang_id": big_bang_id,
                },
            )
            await memory.ensure_session(
                actor_id=actor_id,
                universe_id=root_universe_id,
                metadata={
                    "tick": 0,
                    "big_bang_id": big_bang_id,
                    "kind": "hero_session",
                },
            )
        except Exception as exc:
            _log.warning(
                "memory bootstrap failed for hero %s: %s; continuing",
                actor_id, exc,
            )


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------


async def initialize_big_bang(
    input: InitializerInput,
    *,
    session: AsyncSession,
    sot: SoTBundle | None = None,
    provider_rate_limiter: ProviderRateLimiter,
    run_root: Path | None = None,
    routing: RoutingTable | None = None,
) -> InitializerResult:
    """Execute the Big Bang initializer end-to-end.

    See module docstring for the full lifecycle.  Steps:

    a. Generate IDs.
    b. Load SoT bundle if not provided.
    c. ``Ledger.begin_run`` — writes manifest + config_snapshot.json.
    d. Persist inputs to ``runs/.../input/``.
    e. Build initializer prompt packet.
    f. Persist prompt to ``initialization/initializer_prompt.md``.
    g. Load RoutingTable.
    h. Call ``call_with_policy``.  Persist raw response.
    i. Parse + JSONSchema-validate via ToolParser.
    j. Validate required PRD §9.3 / §9.5 fields; raise InitializerValidationError.
    k–n. Insert archetype / cohort / hero / event ORM rows.
    o–p. Insert BigBangRun + Universe rows.
    q. session.commit().
    r. Bootstrap memory provider (soft-fail).
    s. Persist parsed output + validation report.
    t. Update BigBangRun.status to "running".
    u. Return InitializerResult.
    """
    # --- a. IDs ---------------------------------------------------------
    big_bang_id = input.big_bang_id or new_id("BB")
    root_universe_id = input.root_universe_id or new_id("U")

    # --- b. SoT bundle --------------------------------------------------
    if sot is None:
        sot = load_sot()

    # --- c/g. Routing + config snapshot --------------------------------
    if routing is None:
        try:
            routing = await RoutingTable.from_db(session)
        except Exception as exc:
            _log.warning("RoutingTable.from_db failed: %s; using defaults", exc)
            routing = RoutingTable.defaults()

    config_snapshot = _build_config_snapshot(
        sot=sot, input=input, routing=routing
    )

    # --- run root -------------------------------------------------------
    from backend.app.core.config import settings as _cfg
    if run_root is None:
        run_root = _cfg.run_root
    run_root = Path(run_root)
    # Ledger.begin_run expects to create runs/<BB_*>/ under run_root, so
    # if the caller passes a directory whose basename is already ``runs``
    # we step up one level so we don't end up with runs/runs/.
    if run_root.name == "runs":
        run_root = run_root.parent

    existing_result = await _existing_initialized_result(
        session=session,
        big_bang_id=big_bang_id,
    )
    if existing_result is not None:
        return existing_result

    # --- c. Begin ledger ----------------------------------------------
    ledger = Ledger.begin_run(
        run_root,
        big_bang_id,
        scenario_text=input.scenario_text,
        sot_snapshot_sha=sot.snapshot_sha256,
        config_snapshot=config_snapshot,
    )
    run_folder = ledger.run_folder

    # SoT snapshot — physical copy under runs/<BB>/source_of_truth_snapshot/
    snapshot_sot_to(sot, run_folder)
    sot_snapshot_path = str(run_folder / "source_of_truth_snapshot")

    # --- d. Persist input scenario + uploaded docs --------------------
    input_file_ids = _persist_inputs(ledger, input)

    # --- e. Build initializer prompt -----------------------------------
    builder = PromptBuilder(sot)
    # Normalise uploaded_docs so the Jinja template (StrictUndefined) doesn't
    # KeyError on optional 'summary'/'excerpt'. Keep the original content
    # under 'content_text' for the input/ ledger artifact path.
    normalised_docs: list[dict] = []
    for doc in input.uploaded_docs:
        d = dict(doc)
        d.setdefault("name", "untitled.txt")
        d.setdefault("summary", (doc.get("content_text") or "")[:240] or "(no summary)")
        d.setdefault("excerpt", (doc.get("content_text") or "")[:1500])
        normalised_docs.append(d)

    packet = builder.build_initializer_packet(
        scenario_text=input.scenario_text,
        uploaded_docs=normalised_docs,
        time_horizon_label=input.time_horizon_label,
        tick_duration_minutes=input.tick_duration_minutes,
        max_ticks=input.max_ticks,
    )

    # --- f. Persist prompt ---------------------------------------------
    ledger.write_artifact(
        "initialization/initializer_prompt.md",
        packet.system,
        immutable=True,
    )
    # Full packet (incl. all metadata) for reproducibility.
    ledger.write_artifact(
        "initialization/initializer_prompt_packet.json",
        packet.model_dump(mode="json"),
        immutable=True,
    )

    # --- h. Call provider ---------------------------------------------
    try:
        result = await call_with_policy(
            job_type="initialize_big_bang",
            prompt=packet,
            routing=routing,
            limiter=provider_rate_limiter,
            ledger=ledger,
            run_id=big_bang_id,
            universe_id=root_universe_id,
            tick=0,
            is_p0=True,
        )
    except Exception as exc:
        _log.exception("initializer LLM call failed: %s", exc)
        # Persist a validation report for the operator and flip status to
        # failed before re-raising.
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message=f"provider call failed: {exc}",
        )
        raise InitializerProviderError(
            f"initializer LLM call failed: {exc}"
        ) from exc

    # Persist the raw response artifact (call_with_policy persists the
    # llm_calls artifact, but operators expect the de-facto canonical
    # "raw response" file at the well-known §19 path).
    ledger.write_artifact(
        "initialization/initializer_response_raw.json",
        {
            "call_id": result.call_id,
            "provider": result.provider,
            "model_used": result.model_used,
            "raw_response": result.raw_response,
            "parsed_json": result.parsed_json,
            "tool_calls": result.tool_calls,
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
            "total_tokens": result.total_tokens,
            "cost_usd": result.cost_usd,
            "latency_ms": result.latency_ms,
            "repaired_once": result.repaired_once,
        },
        immutable=True,
    )

    # --- i/j. Parse + validate -----------------------------------------
    parser = ToolParser(sot)
    raw_parsed = result.parsed_json or {}
    if not isinstance(raw_parsed, dict):
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message="parsed_json was not a dict",
        )
        raise InitializerValidationError(
            "LLM returned invalid JSON; please retry"
        )

    try:
        validated = parser.parse_initializer_output(raw_parsed)
    except ToolParseError as exc:
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message=f"JSONSchema validation failed: {exc}",
        )
        raise InitializerValidationError(
            f"LLM output failed JSONSchema validation: {exc}",
            report={
                "schema_error": str(exc),
                "validator_message": exc.validator_message,
                "payload_excerpt": exc.payload_excerpt,
            },
        ) from exc

    try:
        _validate_required_fields(validated)
    except InitializerValidationError as exc:
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message=f"field validation failed: {exc}",
        )
        raise

    # --- k/l/m/n. Build schemas -----------------------------------------
    archetypes: list[PopulationArchetype] = []
    cohort_states: list[CohortState] = []
    heroes: list[HeroArchetype] = []
    hero_states: list[HeroState] = []
    events: list[Event] = []
    channels: list[dict] = list(validated.get("channels") or [])
    scenario_summary: str = str(validated.get("scenario_summary") or "")

    try:
        for raw_arch in validated["archetypes"]:
            archetype = _build_archetype(raw_arch, big_bang_id=big_bang_id)
            archetypes.append(archetype)
            cohort_states.append(
                _seed_cohort_state(
                    archetype=archetype,
                    universe_id=root_universe_id,
                    scenario_text=input.scenario_text,
                )
            )

        for raw_hero in validated.get("heroes", []):
            hero = _build_hero(raw_hero, big_bang_id=big_bang_id)
            heroes.append(hero)
            hero_states.append(_seed_hero_state(hero=hero, universe_id=root_universe_id))

        for raw_event in validated.get("initial_events", []):
            events.append(
                _build_event(
                    raw_event,
                    universe_id=root_universe_id,
                    max_tick=input.max_ticks,
                )
            )
    except InitializerValidationError as exc:
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message=f"archetype/hero/event build failed: {exc}",
        )
        raise

    # --- o. BigBangRun row ---------------------------------------------
    now = now_utc()
    big_bang = BigBangRun(
        big_bang_id=big_bang_id,
        display_name=input.display_name,
        created_at=now,
        updated_at=now,
        created_by_user_id=input.created_by_user_id,
        scenario_text=input.scenario_text,
        input_file_ids=input_file_ids,
        status="initializing",
        time_horizon_label=input.time_horizon_label,
        tick_duration_minutes=input.tick_duration_minutes,
        max_ticks=input.max_ticks,
        max_schedule_horizon_ticks=input.max_schedule_horizon_ticks,
        source_of_truth_version=sot.version,
        source_of_truth_snapshot_path=sot_snapshot_path,
        provider_snapshot_id=input.provider_snapshot_id or new_id("provsnap"),
        root_universe_id=root_universe_id,
        run_folder_path=str(run_folder),
        safe_edit_metadata={
            "description": "",
            "tags": [],
            "favorite": False,
            "archived": False,
        },
    )

    # --- p. Universe row -----------------------------------------------
    root_universe = Universe(
        universe_id=root_universe_id,
        big_bang_id=big_bang_id,
        parent_universe_id=None,
        child_universe_ids=[],
        branch_from_tick=0,
        branch_depth=0,
        lineage_path=[root_universe_id],
        status="active",
        branch_reason="",
        branch_delta=None,
        current_tick=0,
        latest_metrics={},
        created_at=now,
        frozen_at=None,
        killed_at=None,
        completed_at=None,
    )

    # Universe folder in the ledger (writes universe_manifest.json).
    ledger.begin_universe(
        root_universe_id,
        parent=None,
        branch_from_tick=0,
        branch_delta=None,
    )

    # --- DB writes (k/l/m/n/o/p) --------------------------------------
    try:
        await _persist_db_rows(
            session=session,
            big_bang=big_bang,
            root_universe=root_universe,
            archetypes=archetypes,
            cohort_states=cohort_states,
            heroes=heroes,
            hero_states=hero_states,
            events=events,
        )
    except Exception as exc:
        _log.exception("DB write failed during initializer: %s", exc)
        try:
            await session.rollback()
        except Exception:
            pass
        # Persist a validation report and re-raise.
        await _persist_failure(
            session=session,
            ledger=ledger,
            big_bang_id=big_bang_id,
            root_universe_id=root_universe_id,
            input=input,
            sot=sot,
            run_folder=run_folder,
            sot_snapshot_path=sot_snapshot_path,
            input_file_ids=input_file_ids,
            error_message=f"DB write failed: {exc}",
        )
        raise

    # --- q. commit ------------------------------------------------------
    await session.commit()

    # --- r. memory bootstrap (soft) ------------------------------------
    try:
        await _bootstrap_memory(
            cohort_states=cohort_states,
            hero_states=hero_states,
            archetypes=archetypes,
            heroes=heroes,
            root_universe_id=root_universe_id,
            big_bang_id=big_bang_id,
        )
    except Exception as exc:
        # Should never raise — _bootstrap_memory swallows per-actor errors —
        # but be paranoid.
        _log.warning("memory bootstrap raised: %s", exc)

    # --- s. Persist parsed + validation_report ------------------------
    ledger.write_artifact(
        "initialization/initializer_response_parsed.json",
        validated,
        immutable=True,
    )
    ledger.write_artifact(
        "initialization/validation_report.json",
        {
            "ok": True,
            "archetype_count": len(archetypes),
            "hero_count": len(heroes),
            "channel_count": len(channels),
            "initial_event_count": len(events),
            "scenario_summary_len": len(scenario_summary),
            "checked_required_fields": list(_REQUIRED_ARCHETYPE_FIELDS),
        },
        immutable=True,
    )

    # --- t. Flip status to running ------------------------------------
    await _set_run_status(session=session, big_bang_id=big_bang_id, status="running")
    await session.commit()
    big_bang = big_bang.model_copy(update={"status": "running", "updated_at": now_utc()})

    # --- u. Return ------------------------------------------------------
    return InitializerResult(
        big_bang_run=big_bang,
        root_universe=root_universe,
        archetypes=archetypes,
        initial_cohort_states=cohort_states,
        heroes=heroes,
        initial_hero_states=hero_states,
        initial_events=events,
        channels=channels,
        run_folder=run_folder,
        sot_snapshot_path=sot_snapshot_path,
        scenario_summary=scenario_summary,
    )


# ---------------------------------------------------------------------------
# DB persistence helpers
# ---------------------------------------------------------------------------


async def _existing_initialized_result(
    *,
    session: AsyncSession,
    big_bang_id: str,
) -> InitializerResult | None:
    """Return an existing completed initializer result for idempotent retries."""
    from backend.app.models.runs import BigBangRunModel
    from backend.app.models.universes import UniverseModel

    existing_run = await session.get(BigBangRunModel, big_bang_id)
    if existing_run is None or existing_run.status not in {"running", "completed"}:
        return None
    existing_root = await session.get(UniverseModel, existing_run.root_universe_id)
    if existing_root is None:
        return None
    return InitializerResult(
        big_bang_run=existing_run.to_schema(),
        root_universe=existing_root.to_schema(),
        archetypes=[],
        initial_cohort_states=[],
        heroes=[],
        initial_hero_states=[],
        initial_events=[],
        channels=[],
        run_folder=Path(existing_run.run_folder_path),
        sot_snapshot_path=existing_run.source_of_truth_snapshot_path,
        scenario_summary=(existing_run.scenario_text[:120].strip() + "...")
        if len(existing_run.scenario_text) > 120
        else existing_run.scenario_text.strip(),
    )


async def _persist_db_rows(
    *,
    session: AsyncSession,
    big_bang: BigBangRun,
    root_universe: Universe,
    archetypes: list[PopulationArchetype],
    cohort_states: list[CohortState],
    heroes: list[HeroArchetype],
    hero_states: list[HeroState],
    events: list[Event],
) -> None:
    """Insert all initial ORM rows in a single async session.

    Order matters: BigBangRun (FK target) → Universe → archetypes → cohorts
    → heroes/hero_states → events. We flush after each batch to surface FK
    errors at the right call site.
    """
    # Imported lazily so test code can monkey-patch these models.
    from backend.app.models.cohorts import CohortStateModel, PopulationArchetypeModel
    from backend.app.models.events import EventModel
    from backend.app.models.heroes import HeroArchetypeModel, HeroStateModel
    from backend.app.models.runs import BigBangRunModel
    from backend.app.models.universes import UniverseModel

    bbr = await session.get(BigBangRunModel, big_bang.big_bang_id)
    if bbr is None:
        bbr = BigBangRunModel.from_schema(big_bang)
        session.add(bbr)
    else:
        existing_meta = dict(bbr.safe_edit_metadata or {})
        new_meta = dict(big_bang.safe_edit_metadata or {})
        bbr.display_name = big_bang.display_name
        bbr.created_by_user_id = big_bang.created_by_user_id
        bbr.scenario_text = big_bang.scenario_text
        bbr.input_file_ids = list(big_bang.input_file_ids)
        bbr.status = big_bang.status
        bbr.time_horizon_label = big_bang.time_horizon_label
        bbr.tick_duration_minutes = big_bang.tick_duration_minutes
        bbr.max_ticks = big_bang.max_ticks
        bbr.max_schedule_horizon_ticks = big_bang.max_schedule_horizon_ticks
        bbr.source_of_truth_version = big_bang.source_of_truth_version
        bbr.source_of_truth_snapshot_path = big_bang.source_of_truth_snapshot_path
        bbr.provider_snapshot_id = big_bang.provider_snapshot_id
        bbr.root_universe_id = big_bang.root_universe_id
        bbr.run_folder_path = big_bang.run_folder_path
        bbr.safe_edit_metadata = {**new_meta, **existing_meta}
    await session.flush()

    uni = await session.get(UniverseModel, root_universe.universe_id)
    if uni is None:
        session.add(UniverseModel.from_schema(root_universe))
    else:
        uni.big_bang_id = root_universe.big_bang_id
        uni.parent_universe_id = root_universe.parent_universe_id
        uni.lineage_path = list(root_universe.lineage_path)
        uni.branch_from_tick = root_universe.branch_from_tick
        uni.branch_depth = root_universe.branch_depth
        uni.status = root_universe.status
        uni.branch_reason = root_universe.branch_reason
        uni.branch_delta = dict(root_universe.branch_delta) if root_universe.branch_delta else None
        uni.current_tick = root_universe.current_tick
        uni.latest_metrics = dict(root_universe.latest_metrics)
        uni.frozen_at = root_universe.frozen_at
        uni.killed_at = root_universe.killed_at
        uni.completed_at = root_universe.completed_at
    await session.flush()

    for arch in archetypes:
        if await session.get(PopulationArchetypeModel, arch.archetype_id) is None:
            session.add(PopulationArchetypeModel.from_schema(arch, big_bang_id=big_bang.big_bang_id))
    await session.flush()

    for cs in cohort_states:
        if await session.get(CohortStateModel, (cs.cohort_id, cs.tick)) is None:
            session.add(CohortStateModel.from_schema(cs))
    await session.flush()

    for hero in heroes:
        if await session.get(HeroArchetypeModel, hero.hero_id) is None:
            session.add(HeroArchetypeModel.from_schema(hero, big_bang_id=big_bang.big_bang_id))
    await session.flush()

    for hs in hero_states:
        if await session.get(HeroStateModel, (hs.hero_id, hs.tick)) is None:
            session.add(HeroStateModel.from_schema(hs))
    await session.flush()

    for ev in events:
        if await session.get(EventModel, ev.event_id) is None:
            session.add(EventModel.from_schema(ev))
    await session.flush()


async def _set_run_status(
    *, session: AsyncSession, big_bang_id: str, status: str
) -> None:
    """Update only the status column on the BigBangRun row."""
    from sqlalchemy import update

    from backend.app.models.runs import BigBangRunModel

    await session.execute(
        update(BigBangRunModel)
        .where(BigBangRunModel.big_bang_id == big_bang_id)
        .values(status=status, updated_at=now_utc())
    )


async def _persist_failure(
    *,
    session: AsyncSession,
    ledger: Ledger,
    big_bang_id: str,
    root_universe_id: str,
    input: InitializerInput,
    sot: SoTBundle,
    run_folder: Path,
    sot_snapshot_path: str,
    input_file_ids: list[str],
    error_message: str,
) -> None:
    """Persist a validation_report + insert/update BigBangRun row as failed.

    Idempotent: if BigBangRun row doesn't exist yet (we failed before the
    DB write), insert it with status='failed'. If it does exist, just
    update the status column.
    """
    # Validation report — never blocks the failure path.
    try:
        ledger.write_artifact(
            "initialization/validation_report.json",
            {
                "ok": False,
                "error": error_message[:2000],
            },
            immutable=True,
        )
    except Exception as exc:
        _log.warning("could not write validation_report: %s", exc)

    try:
        from backend.app.models.runs import BigBangRunModel

        # The session may already be in a failed transaction (asyncpg aborts
        # the whole tx on the first error). Roll back before any new query so
        # we don't get InFailedSQLTransactionError on the SELECT below.
        try:
            await session.rollback()
        except Exception:
            pass

        # Try to update an existing row.
        result = await session.get(BigBangRunModel, big_bang_id)
        if result is None:
            # Insert a minimal failed row so the run shows up in the runs list.
            now = now_utc()
            failed_row = BigBangRunModel(
                big_bang_id=big_bang_id,
                display_name=input.display_name,
                scenario_text=input.scenario_text,
                input_file_ids=list(input_file_ids),
                status="failed",
                time_horizon_label=input.time_horizon_label,
                tick_duration_minutes=input.tick_duration_minutes,
                max_ticks=input.max_ticks,
                max_schedule_horizon_ticks=input.max_schedule_horizon_ticks,
                source_of_truth_version=sot.version,
                source_of_truth_snapshot_path=sot_snapshot_path,
                provider_snapshot_id=input.provider_snapshot_id or new_id("provsnap"),
                root_universe_id=root_universe_id,
                run_folder_path=str(run_folder),
                safe_edit_metadata={"failure_reason": error_message[:500]},
                created_by_user_id=input.created_by_user_id,
                created_at=now,
                updated_at=now,
            )
            session.add(failed_row)
        else:
            await _set_run_status(session=session, big_bang_id=big_bang_id, status="failed")
        await session.commit()
    except Exception as exc:
        _log.warning("could not persist failed BigBangRun row: %s", exc)
        try:
            await session.rollback()
        except Exception:
            pass
