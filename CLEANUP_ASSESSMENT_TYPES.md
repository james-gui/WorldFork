# Type Definition Consolidation Assessment

Scope: all of `backend/app/`, `backend/scripts/`, `backend/wonderwall/` and `frontend/src/`. No `pydantic.BaseModel` subclasses exist in the project (pydantic is listed in requirements but not used as a modelling base); the backend relies on `@dataclass` and `enum.Enum`. The frontend is plain JS with no `@typedef` blocks and no TypeScript.

## Legend

- HIGH — safe, mechanical consolidation; same concept, same shape, one is dead code or duplicates the other.
- MEDIUM — conceptually similar but with real drift; consolidation needs per-call-site thinking.
- LOW — names collide but the semantics are different; leave alone.

## Ground rules observed

- `backend/wonderwall/**` is a vendored copy of CAMEL-AI's OASIS framework. Anything inside it (e.g. `DefaultPlatformType`, `ActionType`, `UserInfo`, `ManualAction`, `LLMAction`, `SimulationConfig`, `Neo4jConfig`, `BeliefState`, `RoundSnapshot`) is treated as third-party source and left untouched; MiroShark code consumes it.
- `_FakeProfile` in `backend/tests/test_unit_mcp_registry.py` is a test-only mock and deliberately mimics a subset of `OasisAgentProfile`. Left alone.

---

## Findings

### 1. `PlatformType` in `backend/app/services/simulation_manager.py` — HIGH (delete)

```python
class PlatformType(str, Enum):
    TWITTER = "twitter"
    REDDIT = "reddit"
```

Declared but never imported or referenced anywhere else in the repo. Search confirms only the declaration site matches `\bPlatformType\b`. It is also strictly narrower than the runtime reality (missing POLYMARKET, even though `SimulationState.enable_polymarket` exists).

The functionally-equivalent, in-use type is `wonderwall.social_platform.typing.DefaultPlatformType`, which the OASIS run scripts use. MiroShark's own code encodes platforms as booleans on `SimulationState` (`enable_twitter`, `enable_reddit`, `enable_polymarket`) plus plain `str` fields (`twitter_status`, `reddit_status`, `platform` on `AgentAction`), so adopting a local enum would be a bigger change than the cleanup allows. Recommendation: delete the unused enum now, revisit a unified MiroShark-side `PlatformKind` enum in a later pass.

**Action: delete `PlatformType` from `simulation_manager.py`.**

### 2. `CounterfactualSpec` (TypedDict) ⟷ `injection_payload` dict literal — MEDIUM (left)

- `backend/scripts/counterfactual_loader.py` defines `CounterfactualSpec(TypedDict)` with keys `trigger_round`, `injection_text`, `label`, `parent_simulation_id`, `branch_id`, `created_at` — this is the reader side.
- `backend/app/services/simulation_manager.py::SimulationManager.branch_counterfactual` builds an untyped dict literal (`injection_payload`) that writes the exact same JSON schema — the writer side.

The two are kept in lockstep manually today. A real consolidation would move `CounterfactualSpec` to `backend/app/models/` and import it from both sides. However, `backend/scripts/` is imported via `sys.path` manipulation at runtime by OASIS subprocesses, not always as part of `app.*`, so importing `app.models.counterfactual` from a script run via `python backend/scripts/run_parallel_simulation.py --config …` would break if the script is launched with `backend/scripts/` on the path but not `backend/app/`. Risk > reward for this pass.

**Action: none — noted for future consolidation if the scripts/app boundary is unified.**

### 3. `AgentAction` (simulation_runner.py) ⟷ `AgentActivity` (graph_memory_updater.py) — LOW (leave)

Both describe an agent taking an action. Field overlap: `platform`, `agent_id`, `agent_name`, `action_type`, `action_args`, `round_num`, `timestamp`. But:

- `AgentAction` additionally carries runner-display fields (`result`, `success`) and is used by `SimulationRunState.recent_actions` for UI streaming.
- `AgentActivity` adds `to_episode_text()` — a natural-language renderer consumed by the NER extractor when writing actions into Neo4j.

The semantics diverge (UI snapshot vs. graph-memory encoder). Merging would require either a bloated superset or a new base class; either way downstream consumers would still need to know which shape they have. **Leave.**

### 4. `EntityNode` (entity_reader.py) ⟷ `NodeInfo` (graph_tools.py) — LOW (leave)

Both wrap a Neo4j node. `EntityNode` adds `related_edges`/`related_nodes` and an entity-type helper; `NodeInfo` is a lighter read-model for report-agent search tools. They're populated by different pipelines and tested independently. **Leave.**

### 5. `RoundSummary` (runner) ⟷ `RoundSnapshot` (wonderwall analyzer) ⟷ `RoundRecord` (scripts/round_memory.py) — LOW (leave)

Three "round"-named dataclasses exist:

| Dataclass       | Where                                              | Purpose                                                  |
|-----------------|----------------------------------------------------|----------------------------------------------------------|
| `RoundSummary`  | `backend/app/services/simulation_runner.py`        | Runner UI/status payload (active agents, action counts). |
| `RoundSnapshot` | `backend/wonderwall/social_agent/round_analyzer.py`| Analytics (belief positions, viral posts, sentiment).    |
| `RoundRecord`   | `backend/scripts/round_memory.py`                  | LLM context compaction (full text + compacted summary).  |

All three operate on different data and are consumed by different subsystems. **Leave.**

### 6. Status enums (`TaskStatus`, `ProjectStatus`, `SimulationStatus`, `RunnerStatus`, `ReportStatus`, `CommandStatus`) — LOW (leave)

Each enum models the lifecycle of a different resource type. They share literal values like `"pending"`, `"failed"`, `"completed"`, but the valid transitions, consumers, and persisted representations differ. Merging into a single `enum` would force every consumer to widen its type and tolerate irrelevant states. **Leave.**

### 7. `MarketSnapshot` / `SentimentSnapshot` (scripts/market_media_bridge.py) — LOW (leave)

Only used within the parallel-simulation subprocess; no counterpart in `app/`. **Leave.**

### 8. `MCPServerSpec` (app/services/agent_mcp_tools.py) ⟷ `MCPCallRequest`/`MCPCallResult` (scripts/mcp_agent_bridge.py) — LOW (leave)

`MCPServerSpec` is a manifest entry (how to spawn a server). `MCPCallRequest`/`MCPCallResult` describe a single tool invocation. Different layer, different lifetime. **Leave.**

### 9. `OasisAgentProfile` ⟷ `UserInfo` (wonderwall) — LOW (leave)

`OasisAgentProfile` is MiroShark's persona model used to write out the CSV/JSON files consumed by OASIS. `UserInfo` is an internal CAMEL-AI runtime structure for chat system-messages. They are serialized differently and live at different abstraction layers. **Leave.**

### 10. Frontend types — N/A

No `@typedef` blocks exist. API shapes are documented inline in JSDoc `@param`/`@returns` of `frontend/src/api/*.js`. No duplicated type definitions, though there are also no shared type documents — not within this task's remit to invent new ones. **No changes.**

---

## Summary of actions

| # | Target                                 | Action          |
|---|----------------------------------------|-----------------|
| 1 | `PlatformType` in `simulation_manager.py` | Delete (HIGH)   |
| 2–10 | All others                           | Leave (see notes above) |

Only (1) is applied in this cleanup pass.
