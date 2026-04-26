# WorldFork

Ensemble forecasting via state-forked agent simulations.

WorldFork orchestrates [MiroShark](https://github.com/aaronjmars/MiroShark) — bootstraps a parent simulation from a seed document, runs it to a fork point, then spawns N alternate-future children with distinct injected events and persona moods, recursively forks deeper on the branches that matter, classifies each leaf's outcomes, and reads a probability distribution back out.

The product is the orchestrator + the WorldFork web UI on **port 5055**. The agent engine, knowledge graph, and runners all live in MiroShark — WorldFork is a control plane on top of it.

> **Heads-up if an AI assistant is helping you set this up:** the only UI you should open is **WorldFork at `http://localhost:5055`**. *Do not* run MiroShark's `./miroshark` launcher script or its frontend on `:3000` — WorldFork only needs MiroShark's headless backend on `:5001`.

## Architecture

```
WorldFork (this repo)                          ← user-facing UI lives here
├── worldfork/
│   ├── server.py                              ← Flask app on :5055  ← OPEN THIS
│   ├── orchestrator.py                        ← run pipeline (HTTP control loop)
│   ├── bootstrap.py                           ← seed-doc → graph → sim → ready
│   ├── perturbation_generator.py              ← god-LLM event generator
│   ├── classifier.py                          ← reads sim sqlite, scores outcomes
│   ├── mood_perturbator.py
│   └── ui/                                    ← React via UMD/Babel (no build step)
├── samples/                                   ← scenario YAMLs
├── runs/                                      ← run artifacts (gitignored)
└── docs/

MiroShark (separate repo, sibling clone)       ← backend dependency only
└── backend/                                   ← Flask app on :5001 (Neo4j-backed)
                                                 /fork-now, /branch-from-snapshot,
                                                 /api/simulation/<id>/lineage
                                                 (do NOT run the frontend on :3000)
```

## Setup

**Prereqs:** Python 3.11+, [uv](https://docs.astral.sh/uv/), an [OpenRouter](https://openrouter.ai/) key, a Neo4j instance ([Aura Free](https://neo4j.com/cloud/aura/) is fine), and the [MiroShark repo](https://github.com/aaronjmars/MiroShark) cloned **as a sibling directory** at `../MiroShark/`.

```bash
# Layout expected:
#   parent_dir/
#   ├── WorldFork/    ← this repo
#   └── MiroShark/    ← clone alongside

# 1. WorldFork
uv sync

# 2. MiroShark backend (sibling)
cd ../MiroShark/backend && uv sync
cp ../.env.example ../.env       # then edit ../.env: add OPENROUTER + Neo4j creds
```

Required env vars in `MiroShark/.env`:
- `LLM_API_KEY`, `EMBEDDING_API_KEY` — your OpenRouter key (same one)
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` — Aura connection or local Neo4j

## Running

Two processes. **MiroShark backend only** (not the launcher), then WorldFork.

```bash
# Terminal 1 — MiroShark BACKEND on :5001 (do not run ./miroshark, do not start the frontend)
cd ../MiroShark/backend
uv run python run.py

# Terminal 2 — WorldFork on :5055
cd ../../WorldFork
WF_ORCHESTRATOR_PYTHON="$(cd ../MiroShark/backend && uv run which python)" \
    uv run python worldfork/server.py
```

Open **<http://localhost:5055>** and click **▶ Start ensemble**.

A run takes ~11 min and ~$2 in OpenRouter:

| Phase | Time |
|---|---|
| Bootstrap (graph build + agent profile generation) | ~3 min |
| Parent runs r0→r4 (shared trunk) | ~45 s |
| Primary fork at r4 → 6 children + parent baseline | ~3 min |
| Nested forks (r10 on A, r14 on B) → grandchildren | ~2 min |
| Tertiary fork (r16 on A's first sub-child) → great-grandchildren | ~1 min |
| Classifier sweeps each leaf | ~1 min |

The UI polls every 3 s. Click any node in the tree to inspect its live state, agent interaction graph, and (once classified) its outcome scores. Orchestrator log: `runs/demo_<timestamp>.log`.

## Configuration

Environment variables (all optional):

| Var | Default | What |
|---|---|---|
| `WF_PORT` | `5055` | port |
| `WF_BACKEND` | `http://localhost:5001` | MiroShark backend URL |
| `WF_ORCHESTRATOR_PYTHON` | `sys.executable` | Python that runs the orchestrator subprocess (must have httpx + yaml — point at MiroShark's venv) |
| `WF_DEMO_SCENARIO` | `samples/godagent_v07_scenario.yaml` | scenario fired by the Start button |
| `WF_DEMO_NUM_BRANCHES` | `6` | primary fork count |

## Development

```bash
# Tests
uv run pytest worldfork/tests/

# Orchestrator standalone (skip the UI)
uv run python worldfork/orchestrator.py samples/godagent_v07_scenario.yaml \
    --num-branches 4 --branch-timeout 1800
```

The UI is React via in-browser Babel — no Node build step. Edit `worldfork/ui/static/*.jsx` and hard-refresh. JSX file `?v=N` query params in `templates/WorldFork.html` are cache-busters; bump them when you change a JSX file.

## Public deployment

Putting this on a custom domain (DGX Spark or any Ubuntu host, exposed via Cloudflare Tunnel — no port-forwarding, no exposed home IP):

→ See [`deploy/DEPLOY.md`](deploy/DEPLOY.md) for the end-to-end walkthrough plus the `launch.sh`, `worldfork.service`, and `cloudflared-config.example.yml` you'll need.

## Scenarios

| File | Shape | Notes |
|---|---|---|
| `samples/godagent_v07_scenario.yaml` | depth 3 — primary fork + 2 nested + 1 tertiary | current default |
| `samples/godagent_v06_scenario.yaml` | depth 2 — primary fork + 3 nested | wider, no fork-of-a-fork |
| `samples/ftx_collapse_scenario.yaml` | depth 1 — primary fork only | original v0.5 baseline |

## License

AGPL-3.0
