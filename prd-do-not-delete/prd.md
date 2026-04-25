# WorldFork Full Product Requirements Document

**Version:** 4.0 Full Implementation PRD  
**Product:** WorldFork  
**Primary backend language:** Python  
**Frontend:** React/TypeScript  
**Default LLM provider:** OpenRouter  
**Optional memory provider:** Zep / Graphiti  
**Status:** Implementation-ready  
**Audience:** AI coding agents, engineers, designers, PMs, and reviewers  

This document is intentionally standalone. It should be possible to implement the system without reading any prior conversation, chat history, or design notes.

---

## 1. Executive Summary

WorldFork is an explainable, recursively branching social-simulation platform. A user creates a root scenario called a **Big Bang**, and the system initializes a structured simulated society made of **population archetypes**, **dynamic cohort states**, **hero agents**, **news/media channels**, **social-media feeds**, **event queues**, and **sociology rules**. The simulation advances in configurable **ticks**. At each tick, cohort and hero agents see only the information visible to them, decide what to say or do through structured tool calls, and update the simulated social world.

At meaningful decision points, a **God-agent** can create alternate timelines. Every timeline can branch again. This means the multiverse is not a one-time fanout from the root; it is a recursive tree/DAG of possible futures. Each child universe has its own state, events, posts, cohorts, and branch history. Each child universe may itself branch repeatedly, subject to configured rate limits, branch limits, cost budgets, and pruning rules.

WorldFork does **not** simulate one LLM agent per person. Instead, each LLM call usually represents a coherent **cohort state**: a group of people with shared context, media exposure, issue stance, emotion profile, trust relations, and expression level. Influential individuals are modeled as **hero agents**. Cohorts can split, merge, grow, shrink, and shift across stance/expression states as the simulation evolves.

The full system includes:

- Python-first backend
- async job queues
- provider abstraction with OpenRouter default
- rate-limit-aware branching scheduler
- source-of-truth taxonomies
- sociology update layer
- recursive branch engine
- optional Zep memory integration
- optional OASIS/social-platform adapter
- full run ledger for reproducibility
- polished UI pages with 17 reference mockups

The signature product experience:

> Create a Big Bang → simulate society → watch timelines recursively fork → inspect every state, event, post, branch, and decision.

---

## 2. Product Goals

WorldFork must:

1. Let users define a scenario and launch a Big Bang simulation.
2. Initialize society from scenario text and optional uploaded reference materials.
3. Represent large populations using cohort agents rather than one LLM per person.
4. Represent highly influential individuals as hero agents.
5. Support short-to-mid-term simulations ranging from one week to two years.
6. Use configurable ticks where users define simulated time granularity.
7. Support event queues and scheduled future actions.
8. Support social media posts, amplification, news channels, and selective exposure.
9. Use source-of-truth taxonomies for emotions, behavior axes, ideology axes, expression levels, event types, tools, and prompt contracts.
10. Use prompt-based behavior control with structured JSON/tool outputs.
11. Allow cohort populations to split, merge, and migrate between states.
12. Support recursive branching of universes to arbitrary depth within policy limits.
13. Use a God-agent to review each universe after each tick and branch/freeze/kill/continue.
14. Execute background work asynchronously.
15. Respect provider model limits, rate limits, concurrency limits, token limits, and budget limits.
16. Default to OpenRouter while supporting modular provider adapters.
17. Optionally use Zep for memory/context retrieval while preserving the local run ledger as canonical truth.
18. Provide a polished UI for creation, live simulation, recursive branching, review, logs, settings, integrations, and memory.
19. Persist all prompts, responses, tool calls, state snapshots, source-of-truth files, and configs for reproducibility.
20. Allow safe replay and audit of completed sessions.

---

## 3. Non-Goals

WorldFork is not:

1. A scientifically validated real-world prediction engine by default.
2. A one-agent-per-person digital twin platform.
3. A real social network for real users.
4. A product that grants agents omniscient access to all world state.
5. A hidden activation-vector steering system.
6. A black-box simulation without logs.
7. A system that allows historical run artifacts to be rewritten.
8. A system that generates tactical instructions for violence or unlawful activity.

WorldFork may model escalation categories and unrest risk at a high level, but it must not generate operational or tactical guidance for real-world violence.

---

## 4. Key Design Principles

1. **LLMs propose; the engine validates and commits.**  
   LLM outputs are proposals, not direct mutations of canonical state.

2. **No omniscient agents.**  
   Cohorts and heroes receive selective, visibility-filtered prompt packets.

3. **Branching is recursive.**  
   Any universe can branch at any tick. Children can branch again.

4. **Run ledger is canonical.**  
   External memory is optional and never replaces durable artifacts.

5. **Source-of-truth taxonomies control language.**  
   Emotions, behaviors, ideology axes, tools, and event types are defined in versioned files.

6. **Backend is modular Python.**  
   The simulation engine, provider layer, branch engine, sociology engine, memory adapter, and queues must be separate modules.

7. **Rate limits shape branching.**  
   Branches must obey provider capacity and budget constraints.

8. **Every decision is replayable.**  
   Prompts, responses, parsed decisions, tool calls, state snapshots, and God-agent decisions are persisted.

---

## 5. User Personas

### 5.1 Simulation Creator
Defines scenarios, launches Big Bangs, configures ticks, model providers, and branching policies.

### 5.2 Research Reviewer
Reviews completed simulations, audits decisions, inspects branching, and exports results.

### 5.3 Demo Operator
Uses the system live to show recursive timelines, graph views, emotion trends, and review mode.

### 5.4 System Admin
Configures OpenRouter, fallback providers, rate limits, Zep, OASIS, worker queues, webhooks, and source-of-truth files.

### 5.5 AI Coding Agent
An implementation agent that reads this PRD and builds the product. This PRD includes enough architectural and schema detail for that workflow.

---

## 6. Product Terminology

### 6.1 Big Bang
The root scenario/configuration that starts a simulation family.

### 6.2 Universe
A single timeline branch within a Big Bang.

### 6.3 Multiverse
The full recursive graph of universes descended from the same Big Bang.

### 6.4 Tick
One discrete simulation step. The user controls tick duration, e.g. 1 hour, 2 hours, 1 day, 1 week.

### 6.5 Population Archetype
A mostly stable group identity over the time horizon, such as “Bay Area couriers” or “UC Berkeley center-left students.”

### 6.6 Cohort State
A mutable population slice inside an archetype, such as “Bay Area couriers / oppose / active speaker / 1,200 people.”

### 6.7 Hero Agent
A high-impact individual agent representing a real or fictional influential figure, executive, organizer, journalist, regulator, or politician.

### 6.8 Event
A scheduled or realized world action, e.g. protest, statement, leak, crackdown, apology, policy vote.

### 6.9 Social Post
A public content item in the platform layer.

### 6.10 Channel
A social-media platform, news outlet, institution channel, or communication source.

### 6.11 God-Agent
Universe-level reviewer that decides whether a universe should continue, freeze, kill, or branch.

---

## 7. Full Four-Layer Architecture

### 7.1 Layer 1: Foundation Layer

This layer defines the objects, schemas, registries, and canonical stores. It must be built first.

Owns:

- source-of-truth loader
- source-of-truth validators
- Big Bang manifests
- universe manifests
- clock configuration
- population archetypes
- cohort states
- hero archetypes and states
- event registry
- social post registry
- channel registry
- graph registry
- prompt packet builder
- tool registry
- run ledger
- provider configuration
- model routing configuration
- rate-limit configuration
- branch policy configuration
- memory adapter configuration

### 7.2 Layer 2: Sociology Layer

This layer updates society based on observed events, posts, trust, attention, emotion, identity, and thresholds.

Owns:

- attention decay
- event salience
- belief/opinion drift
- emotional state update
- trust update
- expression-level update
- spiral-of-silence behavior
- threshold mobilization
- complex contagion
- homophily rewiring
- identity salience
- coalition formation
- cohort split and merge
- population mass transfer

### 7.3 Layer 3: Platform and Multiverse Layer

This layer manages public environment dynamics and universe branching.

Owns:

- social feed ranking
- post visibility
- news publication
- channel exposure
- OASIS adapter or mini-platform fallback
- event scheduling and resolution
- universe tick orchestration
- God-agent review
- branch candidate creation
- recursive branch creation
- freeze/kill/merge branch policies
- branch-aware rate scheduling
- queue scheduling

### 7.4 Layer 4: Review and UX Layer

This layer presents all state to the user.

Owns:

- landing page
- create Big Bang wizard
- live simulation dashboard
- network graph view
- recursive multiverse explorer
- universe timeline detail
- review mode
- run history
- session detail
- settings/configuration
- integrations/API providers
- model routing/rate limits
- background jobs monitor
- branch policy studio
- Zep memory integration view
- API logs and webhooks

---

## 8. Source-of-Truth System

All qualitative concepts must live in versioned source-of-truth files. Prompts, UI labels, validators, and schema renderers must read from these files.

### 8.1 Required Folder

```text
source_of_truth/
  emotions.json
  behavior_axes.json
  ideology_axes.json
  expression_scale.json
  issue_stance_axes.json
  event_types.json
  social_action_tools.json
  channel_types.json
  actor_types.json
  sociology_parameters.json
  prompt_contracts/
    initializer_schema.json
    cohort_decision_schema.json
    hero_decision_schema.json
    god_review_schema.json
  prompt_templates/
    initializer.md
    cohort_tick.md
    hero_tick.md
    god_review.md
```

### 8.2 Source-of-Truth Rules

1. Every file has a version.
2. Every Big Bang copies the full source-of-truth snapshot into the run folder.
3. Old runs never update when global source-of-truth files change.
4. Prompt builders must render definitions from source-of-truth files, not hardcode labels.
5. Validators reject unknown emotion IDs, behavior axes, event types, or tool IDs.

### 8.3 Default Emotions

Scale: `0–10`.

Required default emotions:

1. anger
2. fear
3. distrust
4. trust
5. hope
6. calm
7. confusion
8. urgency
9. sympathy
10. disgust
11. resentment
12. sadness

Example:

```json
{
  "key": "anger",
  "label": "Anger / Outrage",
  "definition": "Perceived violation, injustice, betrayal, or attack.",
  "scale": {"min": 0, "max": 10},
  "anchors": {
    "0": "No anger; accepts or ignores the issue.",
    "3": "Mild irritation or complaint.",
    "5": "Clear anger and criticism.",
    "8": "Strong outrage and confrontation.",
    "10": "Extreme outrage; highly escalatory affect."
  }
}
```

### 8.4 Default Behavior Axes

Scale: `0–1` unless otherwise specified.

Default axes:

- stubbornness
- openness_to_change
- evidence_sensitivity
- source_credulity
- authority_deference
- contrarianism
- sycophancy
- risk_tolerance
- coordination_capacity
- mobilization_capacity
- attention_decay_rate
- media_susceptibility
- spiral_silence_susceptibility
- identity_salience_sensitivity
- analytical_depth

Use `analytical_depth`, `evidence_sensitivity`, and `source_credulity` instead of “intelligence.”

### 8.5 Ideology Axes

```json
{
  "economic_axis": {
    "range": [-1, 1],
    "negative_label": "redistributive / state-interventionist",
    "positive_label": "market-oriented / pro-capital"
  },
  "cultural_axis": {
    "range": [-1, 1],
    "negative_label": "progressive / cosmopolitan",
    "positive_label": "traditionalist / communitarian"
  },
  "governance_axis": {
    "range": [-1, 1],
    "negative_label": "libertarian / decentralized",
    "positive_label": "authoritarian / centralized"
  },
  "tech_axis": {
    "range": [-1, 1],
    "negative_label": "precautionary / safety-first",
    "positive_label": "accelerationist / innovation-first"
  },
  "institutional_trust_axis": {
    "range": [-1, 1],
    "negative_label": "anti-institutional",
    "positive_label": "institution-trusting"
  }
}
```

### 8.6 Expression Scale

Scale: `0–1`.

| Range | Label | Meaning |
|---|---|---|
| 0.00–0.10 | negligent / unaware | barely aware, no public voice |
| 0.10–0.25 | silent observer | aware but quiet |
| 0.25–0.40 | low-level discussant | occasional low-cost engagement |
| 0.40–0.60 | active speaker | posts, argues, shares |
| 0.60–0.75 | advocate | consistently persuades |
| 0.75–0.90 | organizer | coordinates public or offline action |
| 0.90–1.00 | high-risk escalator | disruptive or risky public-action category |

The system may represent high-risk escalation categories but must not generate tactical instructions for violence.

---

## 9. Core Data Model

Backend schemas should use Pydantic.

### 9.1 BigBangRun

```python
class BigBangRun(BaseModel):
    big_bang_id: str
    display_name: str
    created_at: datetime
    updated_at: datetime
    created_by_user_id: str | None
    scenario_text: str
    input_file_ids: list[str]
    status: Literal["draft", "initializing", "running", "paused", "completed", "failed", "archived"]
    time_horizon_label: str
    tick_duration_minutes: int
    max_ticks: int
    max_schedule_horizon_ticks: int
    source_of_truth_version: str
    source_of_truth_snapshot_path: str
    provider_snapshot_id: str
    root_universe_id: str
    run_folder_path: str
    safe_edit_metadata: dict
```

### 9.2 Universe

```python
class Universe(BaseModel):
    universe_id: str
    big_bang_id: str
    parent_universe_id: str | None
    child_universe_ids: list[str]
    branch_from_tick: int
    branch_depth: int
    lineage_path: list[str]
    status: Literal["candidate", "active", "frozen", "killed", "completed", "merged"]
    branch_reason: str
    branch_delta: dict | None
    current_tick: int
    latest_metrics: dict
    created_at: datetime
    frozen_at: datetime | None
    killed_at: datetime | None
    completed_at: datetime | None
```

### 9.3 PopulationArchetype

```python
class PopulationArchetype(BaseModel):
    archetype_id: str
    label: str
    description: str

    population_total: int
    geography: dict
    age_band: str | None
    education_profile: str | None
    occupation_or_role: str | None
    socioeconomic_band: str | None
    institution_membership: list[str]
    demographic_tags: list[str]

    issue_exposure: float
    material_stake: float
    symbolic_stake: float
    vulnerability_to_policy: float
    ability_to_influence_outcome: float

    ideology_axes: dict[str, float]
    value_priors: dict[str, float]
    behavior_axes: dict[str, float]

    baseline_media_diet: dict[str, float]
    preferred_channels: list[str]
    platform_access: dict[str, float]
    attention_capacity: float
    attention_decay_rate: float

    baseline_trust_priors: dict[str, float]
    identity_tags: list[str]
    ingroup_affinities: dict[str, float]
    outgroup_distances: dict[str, float]

    allowed_action_classes: list[str]
    coordination_capacity: float
    mobilization_capacity: float
    legal_or_status_risk_sensitivity: float

    min_split_population: int
    min_split_share: float
    max_child_cohorts: int
```

### 9.4 CohortState

```python
class CohortState(BaseModel):
    cohort_id: str
    universe_id: str
    tick: int
    archetype_id: str
    parent_cohort_id: str | None
    child_cohort_ids: list[str]

    represented_population: int
    population_share_of_archetype: float

    issue_stance: dict[str, float]
    expression_level: float
    mobilization_mode: str
    speech_mode: str

    emotions: dict[str, float]
    behavior_state: dict[str, float]
    attention: float
    fatigue: float
    grievance: float
    perceived_efficacy: float
    perceived_majority: dict[str, float]
    fear_of_isolation: float
    willingness_to_speak: float
    identity_salience: float

    visible_trust_summary: dict
    exposure_summary: dict
    dependency_summary: dict

    memory_session_id: str | None
    recent_post_ids: list[str]
    queued_event_ids: list[str]
    previous_action_ids: list[str]

    prompt_temperature: float
    representation_mode: Literal["micro", "small", "population", "mass"]
    allowed_tools: list[str]
    is_active: bool
```

### 9.5 HeroArchetype

```python
class HeroArchetype(BaseModel):
    hero_id: str
    label: str
    description: str
    role: str
    institution: str | None
    location_scope: str

    public_reach: float
    institutional_power: float
    financial_power: float
    agenda_control: float
    media_access: float

    ideology_axes: dict[str, float]
    value_priors: dict[str, float]
    trust_priors: dict[str, float]
    behavioral_axes: dict[str, float]

    volatility: float
    ego_sensitivity: float
    strategic_discipline: float
    controversy_tolerance: float
    direct_event_power: float

    scheduling_permissions: list[str]
    allowed_channels: list[str]
```

### 9.6 HeroState

```python
class HeroState(BaseModel):
    hero_id: str
    universe_id: str
    tick: int
    current_emotions: dict[str, float]
    current_issue_stances: dict[str, float]
    attention: float
    fatigue: float
    perceived_pressure: float
    current_strategy: str
    queued_events: list[str]
    recent_posts: list[str]
    memory_session_id: str | None
```

### 9.7 Event

```python
class Event(BaseModel):
    event_id: str
    universe_id: str
    created_tick: int
    scheduled_tick: int
    duration_ticks: int | None

    event_type: str
    title: str
    description: str

    created_by_actor_id: str
    participants: list[str]
    target_audience: list[str]

    visibility: str
    preconditions: list[dict]
    expected_effects: dict
    actual_effects: dict | None
    risk_level: float

    status: Literal["proposed", "scheduled", "active", "completed", "cancelled", "failed", "invalidated"]
    parent_event_id: str | None
    source_llm_call_id: str | None
```

### 9.8 SocialPost

```python
class SocialPost(BaseModel):
    post_id: str
    universe_id: str
    platform: str
    tick_created: int

    author_actor_id: str
    author_avatar_id: str | None
    content: str

    stance_signal: dict[str, float]
    emotion_signal: dict[str, float]
    credibility_signal: float

    visibility_scope: str
    reach_score: float
    hot_score: float

    reactions: dict[str, int]
    repost_count: int
    comment_count: int
    upvote_power_total: float
    downvote_power_total: float
```

### 9.9 BranchNode

```python
class BranchNode(BaseModel):
    universe_id: str
    parent_universe_id: str | None
    child_universe_ids: list[str]
    depth: int
    branch_tick: int
    branch_point_id: str
    branch_trigger: str
    branch_delta: dict
    status: Literal["candidate", "active", "frozen", "killed", "completed", "merged"]
    metrics_summary: dict
    cost_estimate: dict
    descendant_count: int
```

---

## 10. Prompting and Tool Use

### 10.1 Prompt Control Principle

Behavior is controlled by prompt packets, schemas, tools, source-of-truth definitions, and engine validation. WorldFork should not use hidden-vector injection to steer model behavior by default.

### 10.2 Cohort Prompt Packet

Each active cohort receives:

1. system role
2. current clock context
3. archetype baseline
4. current cohort state
5. represented population
6. source-of-truth definitions relevant to the tick
7. visible social feed only
8. visible recent events only
9. own queued events
10. own recent actions
11. retrieved memory summary
12. allowed tools
13. required JSON schema

Agents must not receive global hidden state, invisible posts, other branches, or full run history.

### 10.3 Clock Context Example

```text
Current tick: 4
Tick duration: 2 hours
Elapsed since Big Bang: 8 hours
Time since previous tick: 2 hours
You may schedule events up to 5 ticks / 10 hours into the future.
Post X is 2 ticks old = 4 hours old.
Event Y is scheduled for tick 9 = 10 hours from now.
```

### 10.4 Tool Set

Read tools:

- `read_visible_feed`
- `read_visible_events`
- `read_own_queued_events`
- `read_own_recent_actions`
- `read_retrieved_memory`

Social tools:

- `create_social_post`
- `comment_on_post`
- `repost`
- `upvote_or_promote`
- `downvote_or_criticize`
- `follow_actor`
- `unfollow_actor`
- `stay_silent`

Event tools:

- `queue_event`
- `modify_own_queued_event`
- `cancel_own_queued_event`
- `support_event`
- `oppose_event`

Group tools:

- `propose_split`
- `propose_merge`
- `propose_create_coalition`
- `propose_join_coalition`
- `propose_leave_coalition`

State-report tools:

- `self_rate_emotions`
- `self_rate_issue_stance`
- `estimate_perceived_majority`
- `estimate_willingness_to_speak`
- `estimate_action_threshold`

### 10.5 Output Contract

```json
{
  "public_actions": [],
  "event_actions": [],
  "social_actions": [],
  "self_ratings": {
    "emotions": {},
    "issue_stance": {},
    "perceived_majority": {},
    "willingness_to_speak": 0.0
  },
  "split_merge_proposals": [],
  "decision_rationale": {
    "main_factors": [],
    "uncertainty": "low|medium|high"
  }
}
```

The rationale should be a concise structured explanation. Do not depend on raw chain-of-thought.

---

## 11. Simulation Loop

### 11.1 End-to-End Tick Loop

```python
for universe in active_universes:
    for tick in tick_range:
        resolve_due_events(universe)
        publish_news_and_channel_items(universe)
        compute_visible_feeds(universe)
        select_active_agents(universe)
        build_prompt_packets(universe)
        enqueue_agent_deliberation_jobs(universe)
        collect_agent_outputs(universe)
        parse_and_validate_tool_calls(universe)
        apply_social_actions(universe)
        apply_event_tools(universe)
        update_private_states(universe)
        run_sociology_transitions(universe)
        apply_population_transfers(universe)
        handle_cohort_splits_and_merges(universe)
        update_graphs(universe)
        write_memory_episodes(universe)
        compute_metrics(universe)
        run_god_agent_review(universe)
        apply_branch_freeze_kill_continue_decision(universe)
        persist_tick_snapshot(universe)
```

### 11.2 Active Agent Selection

```text
activity_score =
  base_activity
+ event_salience
+ attention
+ expression_level
+ queued_event_pressure
+ social_pressure
- fatigue
```

Only active cohorts/heroes get LLM calls.

### 11.3 Population Size and Variance

| Represented Population | Mode | Temperature |
|---:|---|---:|
| 1 | hero | 0.7–1.0 |
| 2–25 | micro cohort | 0.8–1.0 |
| 25–250 | small cohort | 0.6–0.8 |
| 250–5,000 | population cohort | 0.35–0.6 |
| 5,000+ | mass cohort | 0.2–0.45 |

Large cohorts should return modal behavior plus substantial minority hints. Small cohorts can be more stochastic.

### 11.4 Social Influence Power

```text
promote_power =
  represented_population^0.65
  * expression_level
  * attention
  * platform_access
  * influence_weight
```

Use sublinear population scaling.

---

## 12. Sociology Layer Details

### 12.1 Core Phenomena

WorldFork should implement operational approximations of:

1. selective exposure
2. attention decay
3. opinion drift
4. trust-mediated persuasion
5. spiral of silence
6. threshold mobilization
7. complex contagion
8. homophily rewiring
9. identity salience
10. coalition formation
11. cohort split/merge

### 12.2 Attention Update

```text
attention_next =
  attention * (1 - attention_decay_rate)
+ event_salience
+ feed_salience
+ personal_impact
+ identity_threat
```

### 12.3 Expression Update

```text
expression_next =
  base_expression
+ anger * 0.25
+ urgency * 0.20
+ perceived_efficacy * 0.15
- fear_of_isolation * 0.25
- fatigue * 0.10
```

Clamp to `[0, 1]`.

### 12.4 Belief Drift

```text
belief_i(t+1) =
  belief_i(t)
+ eta * sum_j(trust_ij * exposure_ij * bounded_kernel(distance(i,j)) * (belief_j - belief_i))
+ event_shock
- stubbornness * (belief_i(t) - baseline_belief_i)
```

### 12.5 Spiral of Silence

A cohort may privately disagree but publicly remain silent if:

```text
fear_of_isolation + perceived_minority_status + institutional_risk > expressive_courage
```

This affects expression, not private belief.

### 12.6 Threshold Mobilization

```text
mobilize_if =
  grievance
+ anger
+ trusted_peer_participation
+ perceived_efficacy
- cost_fear
> mobilization_threshold
```

### 12.7 Cohort Split Conditions

A split is valid only if:

- minority share >= `min_split_share`
- minority population >= `min_split_population`
- semantic/state distance >= `split_distance_threshold`
- child population sums equal parent population
- max child cohort limit not exceeded

### 12.8 Cohort Merge Conditions

A merge is valid when:

- same archetype
- similar stance
- similar expression
- similar memory summary
- low divergence for N ticks
- merge reduces noise without hiding important difference

---

## 13. Recursive Multiverse Branching

### 13.1 Correct Semantics

Branching is recursive. Every universe may branch at any tick, and every child universe may branch again. The multiverse is a recursive tree/DAG.

Correct:

```text
Big Bang
└── U000
    ├── U001
    │   ├── U004
    │   │   └── U009
    │   └── U005
    └── U002
        ├── U006
        └── U007
```

Incorrect:

```text
Big Bang -> A, B, C, D only
```

### 13.2 Branch Creation Flow

1. God-agent detects a potential branch.
2. Branch policy checks thresholds.
3. Scheduler estimates API calls, tokens, and budget impact.
4. If capacity is limited, create a candidate branch.
5. If approved, copy parent state up to branch tick.
6. Apply branch delta.
7. Queue child universe simulation.
8. Update lineage graph.
9. Persist branch metadata and delta.

### 13.3 Branch Delta Examples

```json
{
  "type": "counterfactual_event_rewrite",
  "target_event_id": "event_company_statement_t6",
  "parent_version": "defensive statement",
  "child_version": "apology plus independent audit"
}
```

```json
{
  "type": "parameter_shift",
  "target": "news_channel.local_press.bias",
  "delta": {"risk_salience": 0.2}
}
```

### 13.4 Branch States

- candidate
- active
- frozen
- killed
- completed
- merged

### 13.5 Branch Explosion Controls

```json
{
  "max_active_universes": 50,
  "max_total_branches": 500,
  "max_depth": 8,
  "max_branches_per_tick": 5,
  "branch_cooldown_ticks": 3,
  "min_divergence_score": 0.35,
  "auto_prune_low_value": true
}
```

### 13.6 God-Agent Review

God-agent input:

- recent N ticks
- event proposals
- social posts
- metrics
- branch candidates
- rate-limit state
- budget state
- current universe state
- prior branch history

God-agent output:

- continue universe
- freeze universe
- kill universe
- spawn candidate branch
- spawn active branch
- mark key event
- write tick summary

God-agent must not rewrite parent history.

---

## 14. Python Backend Architecture

### 14.1 Recommended Stack

- FastAPI
- Pydantic
- SQLAlchemy or SQLModel
- Postgres
- Redis
- Celery or Dramatiq
- httpx
- orjson
- NetworkX
- NumPy
- optional Zep SDK/API client
- OpenAI-compatible SDK for OpenRouter

### 14.2 Backend Package Structure

```text
backend/
  app/
    api/
      runs.py
      universes.py
      multiverse.py
      settings.py
      jobs.py
      logs.py
      integrations.py
    core/
      config.py
      ids.py
      clock.py
      logging.py
      security.py
    schemas/
      actors.py
      events.py
      posts.py
      universes.py
      jobs.py
      settings.py
    providers/
      base.py
      openrouter.py
      openai.py
      anthropic.py
      ollama.py
      rate_limits.py
      routing.py
    simulation/
      initializer.py
      tick_runner.py
      prompt_builder.py
      tool_parser.py
      validators.py
    sociology/
      attention.py
      belief.py
      expression.py
      split_merge.py
      graphs.py
    branching/
      god_agent.py
      branch_policy.py
      branch_engine.py
      lineage.py
    memory/
      base.py
      local.py
      zep_adapter.py
    workers/
      queues.py
      jobs.py
      scheduler.py
      retries.py
    storage/
      ledger.py
      artifacts.py
      export.py
```

---

## 15. Async Orchestration and Queues

### 15.1 Why Async Is Required

- One run may create many universes.
- Each universe may have many agents.
- Every tick may require many LLM calls.
- Recursive branching multiplies work.
- Memory sync and exports should not block simulation.

### 15.2 Job Types

- `initialize_big_bang`
- `simulate_universe_tick`
- `agent_deliberation_batch`
- `execute_due_events`
- `social_propagation`
- `sociology_update`
- `god_agent_review`
- `branch_universe`
- `sync_zep_memory`
- `build_review_index`
- `export_run`

### 15.3 Queue Priorities

| Queue | Jobs |
|---|---|
| P0 Critical | universe ticks, branch commits |
| P1 High | cohort/hero deliberation, social propagation |
| P2 Normal | Zep sync, summaries, analytics |
| P3 Low | exports, replay rebuilds |
| Dead Letter | repeated failures |

### 15.4 Async Tick Execution

1. API enqueues `simulate_universe_tick`.
2. Worker locks universe/tick idempotently.
3. Worker builds selective context.
4. Agent deliberations are batched.
5. Provider scheduler enforces rate limits.
6. Results aggregate.
7. Social actions and events apply.
8. Sociology update runs.
9. God-agent review runs.
10. Branch jobs are enqueued.
11. Snapshot is persisted.
12. UI is notified via polling or WebSocket.

### 15.5 Idempotency Requirements

Every job has:

- job_id
- run_id
- universe_id
- tick
- attempt_number
- idempotency_key
- artifact_path

Retries must not duplicate posts, events, or state transitions.

---

## 16. Provider, Model Routing, and Rate Limits

### 16.1 Default Provider: OpenRouter

OpenRouter should be the default because it provides a unified API for hundreds of models through a single endpoint and documents automatic fallback/cost-effective routing. It also documents an OpenAPI spec and OpenAI-compatible usage patterns. See:

- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/api/reference/overview
- https://openrouter.ai/pricing

### 16.2 Default Config

```json
{
  "provider": "openrouter",
  "base_url": "https://openrouter.ai/api/v1",
  "api_key_env": "OPENROUTER_API_KEY",
  "default_model": "openai/gpt-4o",
  "fallback_model": "openai/gpt-4o-mini",
  "json_mode_required": true,
  "tool_calling_enabled": true
}
```

### 16.3 Provider Interface

```python
class LLMProvider(Protocol):
    async def generate_structured(self, prompt: PromptPacket, config: ModelConfig) -> LLMResult: ...
    async def generate_text(self, prompt: PromptPacket, config: ModelConfig) -> LLMResult: ...
    async def embed(self, texts: list[str], config: EmbeddingConfig) -> EmbeddingResult: ...
    async def healthcheck(self) -> ProviderHealth: ...
```

### 16.4 Job-Type Routing

Each job type has:

- preferred provider
- preferred model
- fallback provider/model
- max concurrency
- RPM limit
- TPM limit
- timeout
- retry policy
- daily budget cap

Example:

```json
{
  "job_type": "god_agent_review",
  "preferred_provider": "openrouter",
  "preferred_model": "openai/gpt-4o",
  "fallback_model": "openai/gpt-4o-mini",
  "max_concurrency": 4,
  "requests_per_minute": 60,
  "tokens_per_minute": 150000,
  "timeout_seconds": 120,
  "retry_policy": "exponential_backoff"
}
```

### 16.5 Rate Limit Config

```json
{
  "provider": "openrouter",
  "enabled": true,
  "rpm_limit": 1200,
  "tpm_limit": 10000000,
  "max_concurrency": 40,
  "burst_multiplier": 1.2,
  "retry_policy": "exponential_backoff",
  "jitter": true,
  "daily_budget_usd": 250,
  "branch_reserved_capacity_pct": 20,
  "healthcheck_enabled": true
}
```

### 16.6 Scheduler Rules

Scheduler must:

- obey provider RPM/TPM limits
- obey concurrency caps
- reserve P0 capacity
- throttle branches under pressure
- degrade low-priority jobs first
- support fallback providers
- expose queue pressure to UI
- track per-run and per-provider budgets

### 16.7 Backoff Rules

- 429: exponential backoff + jitter
- 5xx: bounded retry, then fallback
- timeout: retry once, then fallback
- invalid JSON: repair once, then safe no-op
- degraded provider: reduce concurrency and route away

---

## 17. Zep Memory Integration

Zep is optional and secondary to the run ledger.

### 17.1 Role of Zep

Use Zep for:

- cohort memory retrieval
- hero memory retrieval
- temporal graph context
- context assembly
- graph search
- memory summaries

Do not use Zep as canonical truth.

### 17.2 Zep Documentation References

Include links in the product:

- Overview: https://help.getzep.com/overview
- Memory API: https://help.getzep.com/v2/memory
- Sessions: https://help.getzep.com/v2/sessions
- Threads: https://help.getzep.com/threads
- Graph overview: https://help.getzep.com/graph-overview
- Graphiti repo: https://github.com/getzep/graphiti

### 17.3 Implementation Notes

Zep’s docs describe it as a context engineering platform combining agent memory, Graph RAG, and context assembly. The Memory API is documented as a high-level API for adding and retrieving memory. Sessions represent conversation history. Zep’s graph overview describes temporal knowledge graphs with entities, relationships, and facts. Graphiti is the open-source temporal context graph engine associated with Zep.

### 17.4 Zep Mapping Modes

1. Cohort Memory: each cohort maps to a Zep user.
2. Hero Memory: each hero maps to a Zep user.
3. Run-Scoped Threads: each universe/run maps to a Zep thread.
4. Hybrid: cohort memory plus run-scoped thread context.

Default: Cohort Memory.

### 17.5 Sync Triggers

- Big Bang initialization
- end-of-tick summaries
- agent deliberation completion
- cohort split
- cohort merge
- branch creation
- major event completion

### 17.6 Split Inheritance

When a cohort splits:

1. children inherit archetype memory,
2. children inherit parent summary memory,
3. each child gets a split interpretation note,
4. future memory diverges independently.

### 17.7 Zep Failure Handling

If Zep fails:

- log failure
- continue simulation
- use local run ledger summaries
- enqueue resync
- mark memory status degraded

---

## 18. OASIS / Social Platform Adapter

OASIS is optional. A mini-social shell is required as fallback.

WorldFork owns:

- cohorts
- population mass
- emotions
- trust
- events
- branching
- memory
- run ledger

OASIS or mini-shell owns:

- posts
- comments
- reposts
- upvotes
- feed ranking
- trending score
- social visibility

---

## 19. Run Ledger and Reproducibility

Every run must be reproducible.

```text
runs/
  BB_<timestamp>_<slug>/
    manifest.json
    input/
      original_prompt.md
      uploaded_docs/
      scenario_material.json
    source_of_truth_snapshot/
    config/
      provider_config.json
      model_routing.json
      rate_limits.json
      branch_policy.json
      simulation_config.json
    initialization/
      initializer_prompt.md
      initializer_response_raw.json
      initializer_response_parsed.json
      validation_report.json
    universes/
      U000_root/
        universe_manifest.json
        branch_delta.json
        state_current.json
        ticks/
          tick_000/
            clock.json
            universe_state_before.json
            visible_packets/
            llm_calls/
            parsed_decisions.json
            tool_calls.json
            events/
            social_posts/
            sociology/
            memory/
            god/
            universe_state_after.json
        logs/
          event_log.jsonl
          social_posts.jsonl
          tool_calls.jsonl
          graph_updates.jsonl
          metrics.jsonl
    review/
      indexes/
      derived_summaries/
    exports/
```

Historical artifacts are immutable. Only display metadata such as name, description, tags, and favorite/archive status may be edited.

---

## 20. API Specification

### 20.1 Runs

- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `PATCH /api/runs/{run_id}`
- `POST /api/runs/{run_id}/archive`
- `POST /api/runs/{run_id}/duplicate`
- `POST /api/runs/{run_id}/export`

### 20.2 Universes

- `GET /api/universes/{universe_id}`
- `POST /api/universes/{universe_id}/pause`
- `POST /api/universes/{universe_id}/resume`
- `POST /api/universes/{universe_id}/step`
- `POST /api/universes/{universe_id}/branch-preview`
- `POST /api/universes/{universe_id}/branch`
- `GET /api/universes/{universe_id}/ticks/{tick}`
- `GET /api/universes/{universe_id}/lineage`
- `GET /api/universes/{universe_id}/descendants`

### 20.3 Recursive Multiverse

- `GET /api/multiverse/{big_bang_id}/tree`
- `GET /api/multiverse/{big_bang_id}/dag`
- `GET /api/multiverse/{big_bang_id}/metrics`
- `POST /api/multiverse/{big_bang_id}/prune`
- `POST /api/multiverse/{big_bang_id}/focus-branch`
- `POST /api/multiverse/{big_bang_id}/compare`

### 20.4 Settings

- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/settings/providers`
- `PATCH /api/settings/providers`
- `GET /api/settings/model-routing`
- `PATCH /api/settings/model-routing`
- `GET /api/settings/rate-limits`
- `PATCH /api/settings/rate-limits`
- `GET /api/settings/branch-policy`
- `PATCH /api/settings/branch-policy`
- `POST /api/settings/providers/test`

### 20.5 Jobs

- `GET /api/jobs/queues`
- `GET /api/jobs/workers`
- `GET /api/jobs/{job_id}`
- `POST /api/jobs/{job_id}/retry`
- `POST /api/jobs/{job_id}/cancel`
- `POST /api/jobs/queues/{queue}/pause`
- `POST /api/jobs/queues/{queue}/resume`

### 20.6 Logs and Webhooks

- `GET /api/logs/requests`
- `GET /api/logs/webhooks`
- `GET /api/logs/errors`
- `GET /api/logs/audit`
- `GET /api/logs/traces/{trace_id}`
- `POST /api/webhooks/test`
- `POST /api/webhooks/replay`

### 20.7 Zep

- `GET /api/integrations/zep`
- `PATCH /api/integrations/zep`
- `POST /api/integrations/zep/test`
- `POST /api/integrations/zep/sync`
- `GET /api/integrations/zep/mappings`
- `PATCH /api/integrations/zep/mappings`
- `GET /api/integrations/zep/status`

---

## 21. Frontend UI Requirements

The product must use the clean, polished, Google-like style represented by the mockups.

### 21.1 UI Reference Images

The package includes:

1. `assets/mockups/01-landing-page.png`
2. `assets/mockups/02-create-big-bang.png`
3. `assets/mockups/03-simulation-dashboard.png`
4. `assets/mockups/04-network-graph-view.png`
5. `assets/mockups/05-multiverse-view-legacy.png`
6. `assets/mockups/06-universe-timeline-detail.png`
7. `assets/mockups/07-review-mode.png`
8. `assets/mockups/08-run-history.png`
9. `assets/mockups/09-session-detail.png`
10. `assets/mockups/10-settings-configuration.png`
11. `assets/mockups/11-integrations-api-providers.png`
12. `assets/mockups/12-model-routing-rate-limits.png`
13. `assets/mockups/13-background-jobs-queue-monitor.png`
14. `assets/mockups/14-branch-policy-studio.png`
15. `assets/mockups/15-zep-memory-integration.png`
16. `assets/mockups/16-api-logs-webhooks.png`
17. `assets/mockups/17-recursive-multiverse-explorer.png`

### 21.2 Recursive Multiverse Explorer

The corrected recursive branching UI is `17-recursive-multiverse-explorer.png`. It supersedes the old flat multiverse view.

Required elements:

- root Big Bang node
- horizontal tick marks
- recursive branch tree/DAG
- universe rails
- nested branch points
- child branch depth indicators
- status chips: active, candidate, frozen, killed, merged
- collapsed child count pills
- branch hover cards
- right branch inspector
- minimap
- lineage breadcrumbs
- branch history table
- live feed
- zoom/pan/depth controls
- highlight lineage toggle
- collapse inactive toggle
- compare branches button
- simulate next tick button
- autoplay toggle

### 21.3 Interaction Rules

Hover:

- graph nodes show tooltips
- branch points show divergence/confidence/children
- cards elevate slightly
- rows reveal quick actions

Click:

- node selects branch
- branch updates inspector
- lineage breadcrumb filters graph
- event opens detail panel
- compare opens compare mode
- simulate next tick queues job

Double-click:

- focus subtree

Overflow/right-click:

- compare
- freeze
- kill
- export lineage
- replay from branch

---

## 22. Required UI Pages

### 22.1 Landing Page
Marketing entry and feature overview.

### 22.2 Create Big Bang
Wizard for scenario, actors, timeline, models, and review.

### 22.3 Simulation Dashboard
Live KPIs, event queue, feed, emotion trends, cohort inspector, timeline controls.

### 22.4 Network Graph View
Layered multiplex graph with exposure, trust, dependency, mobilization, and identity layers.

### 22.5 Recursive Multiverse Explorer
Recursive branch tree/DAG view.

### 22.6 Universe Timeline Detail
Timeline for one universe with events, cohort shifts, social spikes, God actions, logs.

### 22.7 Review Mode
Tick-by-tick replay and explainability.

### 22.8 Run History
Browse, filter, rename, favorite, archive, duplicate, open runs.

### 22.9 Session Detail
Read-only metadata, inputs, logs, files, reproducibility, export.

### 22.10 Settings & Configuration
Provider defaults, model configs, prompt parameters, source-of-truth, memory, OASIS adapter.

### 22.11 Integrations & API Providers
OpenRouter, OpenAI, Anthropic, Ollama, Zep, webhooks.

### 22.12 Model Routing & Rate Limits
Job-type model policies and provider usage.

### 22.13 Background Jobs & Queue Monitor
Workers, queues, async job status, dead-letter queue.

### 22.14 Branch Policy Studio
Branch thresholds, quotas, cooldowns, pruning, API budget preview.

### 22.15 Zep Memory Integration
Zep settings, mappings, graph preview, latency, cache warming.

### 22.16 API Logs & Webhooks
Provider calls, request traces, errors, webhook replay.

---

## 23. Frontend Stack

Recommended:

- Next.js or Vite + React
- TypeScript
- Tailwind CSS
- Radix UI or shadcn/ui
- TanStack Query
- TanStack Table
- Zustand
- React Flow, Cytoscape, or Sigma.js for graph views
- Recharts or ECharts for charts

---

## 24. Observability

The product must expose:

- queue depth
- active workers
- job latency
- provider latency
- requests/min
- tokens/min
- retry counts
- error rates
- branch budget
- active universes
- candidate branches
- Zep ingestion status
- webhook delivery status

---

## 25. Security

- API keys encrypted at rest.
- API keys never logged.
- Webhook signing secret required.
- Historical artifacts immutable.
- Exports permission-gated.
- Provider keys scoped to workspace.
- Uploaded files sanitized.
- Run folders protected by access control.

---

## 26. Failure Handling

| Failure | Response |
|---|---|
| invalid LLM JSON | repair once, else safe no-op |
| provider timeout | retry then fallback |
| provider 429 | backoff + jitter + throttle |
| branch explosion | enforce max depth/count/cost |
| Zep outage | continue run ledger-only |
| missing artifact | show warning, keep UI usable |
| failed job | retry policy then dead-letter |
| invalid split | reject and log validation error |
| invalid branch delta | reject or create candidate requiring review |

---

## 27. Testing Requirements

### 27.1 Unit Tests

- schema validation
- source-of-truth loading
- population conservation
- split/merge validation
- rate limiter behavior
- branch lineage correctness
- provider fallback
- run ledger writer
- prompt packet construction
- event queue scheduling

### 27.2 Integration Tests

- create Big Bang
- simulate tick
- recursive branch
- run export
- review mode load
- Zep failure fallback
- provider rate-limit fallback
- queue retry/dead-letter flow

### 27.3 E2E Tests

1. create run → simulate → branch recursively → open recursive explorer
2. configure OpenRouter → run tick → inspect logs
3. split cohort → verify population conservation
4. export run → reopen session detail
5. enable Zep → sync → simulate outage → continue run
6. kill/freeze branch → verify recursive UI status updates

---

## 28. MVP Acceptance Criteria

The MVP is complete when:

1. User can create a Big Bang.
2. Python backend initializes world state.
3. At least three ticks run.
4. Cohorts create posts/events.
5. Cohorts can split and transfer population.
6. God-agent can branch a universe.
7. A child branch can branch again.
8. Recursive multiverse explorer displays nested depth.
9. Settings allow provider/model/rate-limit configuration.
10. OpenRouter works as default provider.
11. Run ledger stores full artifacts.
12. Review mode replays ticks.
13. Run history and session detail work.
14. Background job monitor works.
15. Zep integration page exists and can be disabled.
16. Export zip works.

---

## 29. FAQs

### Q1. Is WorldFork one LLM per person?
No. It uses cohort agents to represent groups. Heroes are used for influential individuals.

### Q2. Can cohorts switch sides?
Yes. Population mass migrates across cohort states such as neutral, support, oppose, protest, and silent.

### Q3. Can cohorts split?
Yes. The LLM proposes splits; the engine validates and commits them.

### Q4. Can timelines branch recursively?
Yes. Every universe can branch, and every child universe can branch again.

### Q5. What controls branch explosion?
Max active universes, max total branches, max depth, branch cooldown, branch budget, branch value scoring, and auto-pruning.

### Q6. Is Zep required?
No. Zep is optional memory. The run ledger is the source of truth.

### Q7. Can old sessions be edited?
Only safe display metadata can be edited.

### Q8. Is behavior controlled by activation steering?
No. Behavior is controlled by prompt packets, schemas, tools, and source-of-truth definitions.

### Q9. Why default to OpenRouter?
OpenRouter offers access to many models through a unified API and supports OpenAI-compatible integration patterns and routing/fallback workflows.

### Q10. What happens if rate limits are hit?
The scheduler throttles branches and low-priority jobs, retries with backoff, and uses fallback providers if configured.

### Q11. Why keep Zep secondary to the run ledger?
Because reproducibility and auditability require a deterministic local record of every prompt, response, tool call, event, post, and state transition.

### Q12. Why does the recursive multiverse need a new UI?
Because a flat fanout cannot represent the real product logic. Each child timeline can branch again, so the UI must show nested lineage, depth, and descendants.

---

## 30. Implementation Build Order

1. schemas and source-of-truth loader
2. run ledger
3. provider abstraction with OpenRouter
4. rate limiter and worker queue
5. Big Bang initializer
6. tick runner
7. prompt packet builder
8. tool parser and validators
9. event/social registries
10. sociology engine
11. split/merge engine
12. God-agent review
13. recursive branch engine
14. dashboard and run history
15. recursive multiverse explorer
16. review mode
17. settings/integrations/logs
18. optional Zep adapter
19. export/replay support

---

## 31. Final Product Definition

WorldFork is a Python-backed, asynchronous, recursively branching social simulation system. It represents large populations with structured cohort agents, models high-impact individuals as heroes, uses prompt-driven tool workflows, updates social dynamics through configurable sociology rules, branches timelines recursively through God-agent review, respects provider/rate limits, stores every artifact in a reproducible run ledger, and exposes the full system through polished UI views.

Final product experience:

> Big Bang → society evolves → timelines fork recursively → every future is inspectable.

---

## 32. External References

OpenRouter:

- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/api/reference/overview
- https://openrouter.ai/pricing

Zep:

- https://help.getzep.com/overview
- https://help.getzep.com/v2/memory
- https://help.getzep.com/v2/sessions
- https://help.getzep.com/threads
- https://help.getzep.com/graph-overview
- https://github.com/getzep/graphiti

---

## 33. Deliverables in This Package

- `prd.md`
- `manifest.json`
- `assets/mockups/01-landing-page.png`
- `assets/mockups/02-create-big-bang.png`
- `assets/mockups/03-simulation-dashboard.png`
- `assets/mockups/04-network-graph-view.png`
- `assets/mockups/05-multiverse-view-legacy.png`
- `assets/mockups/06-universe-timeline-detail.png`
- `assets/mockups/07-review-mode.png`
- `assets/mockups/08-run-history.png`
- `assets/mockups/09-session-detail.png`
- `assets/mockups/10-settings-configuration.png`
- `assets/mockups/11-integrations-api-providers.png`
- `assets/mockups/12-model-routing-rate-limits.png`
- `assets/mockups/13-background-jobs-queue-monitor.png`
- `assets/mockups/14-branch-policy-studio.png`
- `assets/mockups/15-zep-memory-integration.png`
- `assets/mockups/16-api-logs-webhooks.png`
- `assets/mockups/17-recursive-multiverse-explorer.png`
