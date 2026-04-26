# Multi-Fork v0.5 — True State-Snapshot Branching (Path A)

## Why this exists

WorldFork v0 produces "branches" that are actually parallel re-runs from round 0.
Every branch shares the same agent profiles but each independently re-simulates
rounds 0..fork_round before applying its perturbation. That works only because
the fork point is hard-coded in the scenario YAML.

The next step is **reactive branching** — a "God LLM" watches a *live* parent
simulation and triggers a fork at an interesting moment (e.g. round 7 when a
specific belief shift happens). For this to be coherent, children must inherit
the parent's *exact* state at the trigger round. Re-running from round 0 would
produce a different history and the triggering event may not even recur.

So we need true state-snapshot forking. This document is the build plan.

---

## What "state" means

Every simulation has state in five places:

| Location | Already on disk? | Action needed |
|---|---|---|
| `<sim_dir>/<platform>_simulation.db` (sqlite) | yes | `cp` to child dir |
| `<sim_dir>/run_state.json` (round counter, started_at, etc.) | yes | `cp` and edit current_round |
| `<sim_dir>/{reddit,twitter,polymarket}_profiles.*` | yes | `cp` |
| `<sim_dir>/counterfactual_injection.json` (if any) | yes | rewrite per child with new perturbation |
| **Camel ChatAgent memories** (in process) | **no** | serialize per-agent → JSON file |
| **Recsys cache** (in process — embeddings, recommendation matrix) | **no** | pickle → file |

The two in-process pieces are the crux. Everything else is just file copying.

---

## Files map (where to make changes)

| Path | Role |
|---|---|
| `backend/scripts/run_parallel_simulation.py` | The runner. Add SIGUSR1 handler + `--resume-from-snapshot` arg. Most of the work lives here. |
| `backend/wonderwall/social_agent/agent.py` | `SocialAgent.__init__` already calls `super().__init__()` (camel ChatAgent). We will add `dump_memory()` and `load_memory()` methods. |
| `backend/wonderwall/social_platform/platform.py` | Has the recsys cache. Add `dump_recsys()` / `load_recsys()`. |
| `backend/app/services/simulation_manager.py` | Existing `branch_counterfactual` is round-0-restart. Add new `branch_from_snapshot(parent_id, snapshot_round, injection_text, label)`. |
| `worldfork/orchestrator.py` | Add `state_fork: true` mode to scenario YAML. When set, use `branch_from_snapshot` instead of `branch_counterfactual`. |
| `worldfork/live_state.py` | Already polls run-status. Extend to detect snapshot files for the live tree. |
| `samples/usdc_depeg_scenario.yaml` | Add `branching.state_fork: true` toggle for the test scenario. |

---

## Build plan — 4 steps with verification gates

Each step has an explicit verification check. **Do not move to step N+1 until step N's verification passes.**

---

### Step 1 — Snapshot mechanism in the runner

**Goal:** A running parent simulation can be told (via SIGUSR1) to dump its in-process state to disk and exit cleanly at the next round boundary.

#### Files to edit

`backend/scripts/run_parallel_simulation.py`

#### Snapshot directory layout (write to)

```
<sim_dir>/snapshot_round_<N>/
  metadata.json           # {round, parent_sim_id, snapshotted_at, agent_count}
  agent_memories.json     # list of {agent_id, social_agent_id, memory_records}
  recsys_cache.pkl        # pickled per-platform recsys state
```

The sqlite DB and run_state.json are read directly from `<sim_dir>` and don't
need to be copied into the snapshot dir — the snapshot is logically a
*pointer-plus-supplements* to the sim dir.

#### Implementation notes

```python
# Pseudocode for the runner's main loop
import signal, json, pickle

_snapshot_requested = False
_snapshot_round_target = None

def _handle_sigusr1(signum, frame):
    global _snapshot_requested
    _snapshot_requested = True

signal.signal(signal.SIGUSR1, _handle_sigusr1)

# In the per-round loop:
async def round_loop():
    while not done:
        await env.step(actions)
        current_round += 1
        if _snapshot_requested:
            await _write_snapshot(current_round)
            print(f"[snapshot] round {current_round} dumped, exiting")
            sys.exit(0)
```

`_write_snapshot()`:

1. For each platform, iterate `agent_graph.agents`. For each agent:
   - `records = agent.memory.retrieve()` → list of `MemoryRecord` (camel)
   - Serialize each record's `BaseMessage` to a dict via `record.message.to_dict()`
   - Bundle as `{social_agent_id, agent_id, role, records: [...]}`
2. For recsys: pickle `platform.rec_matrix`, `platform.last_post_score_cache`, etc. (whichever attrs hold the recsys state — read the existing class first).
3. Write `metadata.json` with the round number.

**Tricky bits:**
- Camel's `OpenAIMessage` may include tool_call entries with non-JSON types. Drop those gracefully — the message text is what matters for behavior.
- The runner is async; the signal arrives on the main thread but we need to checkpoint between rounds, not mid-round. Hence the flag pattern.
- If multiple platforms are enabled (twitter + reddit + polymarket), each runs in its own coroutine. Snapshot all of them at the same logical round.

#### Verification check (Step 1)

Run an existing sim and snapshot it manually:

```bash
# Start a sim through the existing UI or directly via /api/simulation/start
# Get its PID (visible in /api/simulation/<id>/run-status response)

# At ~round 4, send the signal:
kill -USR1 <pid>

# Verify within ~15 sec:
ls /Users/james/Documents/WorldFork/short/MiroShark/backend/uploads/simulations/<sim_id>/
# Expect: snapshot_round_4/ to exist

cat <sim_dir>/snapshot_round_4/metadata.json
# Expect: {"round": 4, "agent_count": 16, ...}

python3 -c "
import json, pickle
mem = json.load(open('<sim_dir>/snapshot_round_4/agent_memories.json'))
print(f'agents serialized: {len(mem)}')
print(f'first agent records: {len(mem[0][\"records\"])}')
recsys = pickle.load(open('<sim_dir>/snapshot_round_4/recsys_cache.pkl', 'rb'))
print(f'recsys keys: {list(recsys.keys()) if isinstance(recsys, dict) else type(recsys)}')
"
# Expect: agents serialized = 16 (matches profile count), records > 0
```

**PASS:** snapshot dir exists with all 3 files; agent count matches; memories have at least 5 records each (since we're past round 4 and message_window_size=10).

**FAIL modes to debug:**
- AttributeError on `agent.memory.retrieve` → camel API changed, check `camel/memories/__init__.py`
- Pickle error on recsys → some torch tensor needs `.cpu().numpy()` before pickle
- JSON serialization failure on memory records → drop tool_call payload fields

---

### Step 2 — Resume-from-snapshot in the runner

**Goal:** A fresh runner process started with `--resume-from-snapshot <path>` loads a snapshot, restores agent memories + recsys, and continues from round (snapshot_round + 1).

#### Files to edit

`backend/scripts/run_parallel_simulation.py` (same file as Step 1)

#### Implementation notes

```python
# CLI parsing
parser.add_argument('--resume-from-snapshot', type=str, default=None)
args = parser.parse_args()

if args.resume_from_snapshot:
    snapshot_dir = Path(args.resume_from_snapshot)
    metadata = json.load(open(snapshot_dir / "metadata.json"))
    start_round = metadata["round"]
    # Skip prepare_simulation() — profiles already exist, sqlite already exists
    # Just initialize agents + restore memories
    await initialize_platform_from_existing_db()
    restore_agent_memories(agent_graph, snapshot_dir / "agent_memories.json")
    restore_recsys(platform, snapshot_dir / "recsys_cache.pkl")
    current_round = start_round
else:
    # Existing path — build everything fresh
    ...
```

`restore_agent_memories(agent_graph, path)`:
1. Load JSON
2. For each entry, find the matching agent by `social_agent_id`
3. Reconstruct each `MemoryRecord` from the dict (use `BaseMessage.from_dict()` if it exists; else manually build `BaseMessage(role_name=..., content=...)`)
4. Call `agent.memory.write_records([rec1, rec2, ...])` to attach

`restore_recsys(platform, path)`:
1. `pickle.load`
2. Set the corresponding attributes on `platform`

#### Verification check (Step 2)

Take the snapshot from Step 1's verification, then run a child from it:

```bash
# Use the existing parent dir as the working dir; just point to the snapshot
.venv/bin/python backend/scripts/run_parallel_simulation.py \
  --simulation-id <child_sim_id_with_copied_files> \
  --resume-from-snapshot <child_sim_dir>/snapshot_round_4 \
  --max-rounds 8

# After it finishes (~3 min):
sqlite3 <child_sim_dir>/reddit_simulation.db "SELECT COUNT(*) FROM post"
# Expect: at least the parent's count at round 4, plus a few new ones from rounds 5-8

# Spot check that memory was restored: agents in round 5 should reference round 0-4 content.
# Read their first post after resume:
sqlite3 <child_sim_dir>/reddit_simulation.db "
  SELECT post_id, substr(content, 1, 100)
  FROM post
  WHERE created_at > '<snapshot_timestamp>'
  ORDER BY post_id LIMIT 3
"
# Expect: posts that build on prior context (mention earlier topics, reply to earlier discussions)
```

**PASS:** child sim ran without crashing; round 5+ posts thematically continue from rounds 0-4 (not generic openings as if starting fresh).

**FAIL modes:**
- Memory records appear empty → check that `write_records` accepts the reconstructed records; camel may need `MemoryRecord(message=..., role=...)` not just message
- Recsys errors during the first round → maybe a numpy dtype mismatch from pickle; fall back to "don't restore recsys, let it rebuild" — minor quality cost, not blocking

---

### Step 3 — `branch_from_snapshot` API in simulation_manager

**Goal:** A single Python call that takes (parent_id, snapshot_round, injection_text, label) and produces a ready-to-run child sim that will resume from the snapshot with the perturbation applied at snapshot_round+1.

#### Files to edit

`backend/app/services/simulation_manager.py`

Add new method on `SimulationManager` (mirror the existing `branch_counterfactual` style):

```python
def branch_from_snapshot(
    self,
    parent_simulation_id: str,
    snapshot_round: int,
    injection_text: str,
    label: str | None = None,
    branch_id: str | None = None,
) -> SimulationState:
    """Fork from an in-progress parent at the given snapshot round.

    Preconditions:
      - parent_simulation_id has a snapshot_round_<N> dir on disk
        (created via SIGUSR1 to the parent's runner)
      - injection_text will fire at round (snapshot_round + 1)

    Steps:
      1. Verify parent's snapshot_round_<N> exists on disk
      2. Create child sim_id + dir (same pattern as fork_simulation)
      3. shutil.copytree the parent dir → child dir, INCLUDING the snapshot
         (sqlite, profiles, run_state.json, snapshot_round_<N>/)
      4. Write child's counterfactual_injection.json with trigger_round=N+1
      5. config_diff records: parent_simulation_id, snapshot_round, label
      6. Return child SimulationState with status=READY and a `resume_snapshot_path`
         field on the state (new field — add to SimulationState dataclass)
    """
```

The `start_simulation` endpoint needs a small extension: if `state.resume_snapshot_path` is set, pass `--resume-from-snapshot <path>` to the runner subprocess.

Find this in `simulation_manager.py` or `simulation_runner.py` — wherever the runner subprocess gets spawned — and append the flag conditionally.

#### Verification check (Step 3)

```python
# Standalone test — assumes Step 1 verification produced a snapshot
import sys
sys.path.insert(0, '/Users/james/Documents/WorldFork/short/MiroShark/backend')
from app.services.simulation_manager import SimulationManager

mgr = SimulationManager()
child = mgr.branch_from_snapshot(
    parent_simulation_id="<parent_sim_id_from_step1>",
    snapshot_round=4,
    injection_text="BREAKING: USDC just hit $0.85 on Coinbase.",
    label="test_state_fork",
)
print(f"child created: {child.simulation_id}")
print(f"resume_snapshot_path: {child.resume_snapshot_path}")
# Verify on disk
import os
child_dir = mgr._get_simulation_dir(child.simulation_id)
print(f"child has snapshot: {os.path.exists(child_dir + '/snapshot_round_4')}")
print(f"child has counterfactual: {os.path.exists(child_dir + '/counterfactual_injection.json')}")
import json
cf = json.load(open(child_dir + '/counterfactual_injection.json'))
assert cf['trigger_round'] == 5  # snapshot_round + 1
assert "USDC just hit $0.85" in cf['injection_text']
print("PASS")
```

**PASS:** child dir exists with snapshot copied + counterfactual scheduled at round 5 + state has `resume_snapshot_path`.

---

### Step 4 — Wire orchestrator + scenario YAML

**Goal:** A scenario YAML with `branching.state_fork: true` causes the orchestrator to (a) bootstrap parent + run it to fork_round, (b) snapshot it, (c) call `branch_from_snapshot` for each perturbation, (d) start each child.

#### Files to edit

- `worldfork/orchestrator.py`
- `samples/usdc_depeg_scenario.yaml` (add the toggle)

#### Implementation notes

In the orchestrator's `run_ensemble`, after `bootstrap_parent` returns:

```python
state_fork = (cfg.get("branching") or {}).get("state_fork", False)

if state_fork:
    # 1. Start the parent runner with max_rounds=fork_round
    await client.start_simulation(parent_sim_id, max_rounds=fork_round)
    # 2. Wait for it to reach fork_round (poll /run-status)
    await _poll_until_round(client, parent_sim_id, fork_round)
    # 3. SIGUSR1 the parent to snapshot
    parent_pid = (await client.get_run_status(parent_sim_id))["process_pid"]
    os.kill(parent_pid, signal.SIGUSR1)
    # 4. Wait for snapshot dir to appear
    snapshot_dir = await _wait_for_snapshot(parent_sim_id, fork_round)
    # 5. For each perturbation:
    for p in perturbations:
        child_state = await client.post("/api/simulation/branch-from-snapshot", json={
            "parent_simulation_id": parent_sim_id,
            "snapshot_round": fork_round,
            "injection_text": p["event_text"],
            "label": p["label"],
        })
        # ... mood modifier still applies (Step C.5 of orchestrator stays the same)
        # ... start_simulation will see resume_snapshot_path and pass the flag
else:
    # Existing perturbation-stacking path
    ...
```

You'll also need a small Flask route in `simulation.py` that exposes `branch_from_snapshot` (mirror the existing `/branch-counterfactual` endpoint).

#### Verification check (Step 4) — the real end-to-end test

```bash
# Update samples/usdc_depeg_scenario.yaml to add:
# branching:
#   state_fork: true
#   fork_round: 4   # later in sim, so we can see whether pre-fork content actually matches

# Run the orchestrator with N=2 for a quick test:
.venv/bin/python worldfork/orchestrator.py \
  samples/usdc_depeg_scenario.yaml \
  sim_0038baece0f7 \
  --num-branches 2 \
  --branch-timeout 1800

# After completion, compare pre-fork sqlite content between parent and children:
PARENT_DIR=/Users/james/Documents/WorldFork/short/MiroShark/backend/uploads/simulations/<parent>
CHILD_A_DIR=...
CHILD_B_DIR=...

# Posts at round 0..fork_round should be IDENTICAL across parent and both children
sqlite3 $PARENT_DIR/reddit_simulation.db "SELECT post_id, content FROM post WHERE post_id <= 5" > /tmp/parent.txt
sqlite3 $CHILD_A_DIR/reddit_simulation.db "SELECT post_id, content FROM post WHERE post_id <= 5" > /tmp/childA.txt
sqlite3 $CHILD_B_DIR/reddit_simulation.db "SELECT post_id, content FROM post WHERE post_id <= 5" > /tmp/childB.txt

diff /tmp/parent.txt /tmp/childA.txt   # expect: no diff
diff /tmp/parent.txt /tmp/childB.txt   # expect: no diff

# Posts after fork_round should DIFFER between children
sqlite3 $CHILD_A_DIR/reddit_simulation.db "SELECT post_id, content FROM post WHERE post_id > 5" > /tmp/childA_post.txt
sqlite3 $CHILD_B_DIR/reddit_simulation.db "SELECT post_id, content FROM post WHERE post_id > 5" > /tmp/childB_post.txt
diff /tmp/childA_post.txt /tmp/childB_post.txt   # expect: substantial diff
```

**PASS:** pre-fork posts are byte-identical across parent + children (proves snapshot/restore is faithful), post-fork posts differ between children (proves perturbation took effect).

**FAIL modes:**
- Pre-fork posts differ → snapshot didn't capture sqlite state correctly OR the children re-simulated rounds 0-4. Check that the runner with `--resume-from-snapshot` actually skips re-running prior rounds.
- Post-fork posts identical between children → perturbation injection didn't fire. Check counterfactual_injection.json was written per-child.

---

## Known risks & mitigations

| Risk | Mitigation |
|---|---|
| Camel `OpenAIMessage.tool_calls` may contain non-JSON callables | Strip `tool_calls` field before serializing; restore behavior comes from re-binding tools fresh on resume |
| Recsys cache uses torch tensors that don't pickle cleanly across processes | `.detach().cpu().numpy()` before pickle; rebuild as torch tensors on load |
| SIGUSR1 arrives mid-round → state inconsistent | Guard with a flag, only snapshot at round-boundary code path |
| Multi-platform (twitter+reddit+polymarket) snapshot needs all 3 platforms paused at same round | The runner already coordinates rounds across platforms; trust that |
| MacOS fork-safety with subprocess | Snapshots are file-based, not process-fork; this is fine |
| Child sim runner doesn't see the snapshot path | Check that `start_simulation` propagates `resume_snapshot_path` → `--resume-from-snapshot` arg correctly |
| Counterfactual injection at round N+1 doesn't fire | Verify `counterfactual_injection.json` has `trigger_round=N+1` and the runner's `_promote_counterfactual_if_due` reads it on the right tick |
| Existing parent sim's process is dead by the time we want to snapshot | The orchestrator must keep the parent alive until snapshot completes — don't `/start` with max_rounds smaller than fork_round |

---

## Effort estimate

- Step 1 (snapshot mechanism): ~6 hours
- Step 2 (resume mechanism): ~6 hours
- Step 3 (branch_from_snapshot + flask route): ~3 hours
- Step 4 (orchestrator integration + e2e test): ~4 hours
- Debugging slack: ~3 hours
- **Total: ~22 hours = 2-3 focused days**

---

## What this unlocks

Once steps 1-4 pass:

- The God LLM auto-detection layer (a separate ~1-day task) can sit on top: tail the parent's events.jsonl, decide when an interesting moment happens, signal the orchestrator, fork at *that* round.
- The current perturbation-stacking mode in the orchestrator becomes a special case (legacy path; keep for fork_round=1 demos).
- The tree visualization handles nested forks naturally — each fork creates a new `parent_simulation_id` chain that the live tree can follow.
