# WorldFork

Ensemble forecasting via state-forked agent simulations.

WorldFork orchestrates [MiroShark](https://github.com/aaronjmars/MiroShark) — bootstraps a parent simulation from a seed document, runs it to a fork point, then spawns N alternate-future children with distinct injected events and persona moods, runs them to horizon, classifies each branch's outcomes, and reads a probability distribution back out.

The product is the orchestrator + the v2 web UI. The agent engine, knowledge graph, and runners all live in MiroShark — WorldFork is a control plane on top of it.

## Architecture

```
WorldFork (this repo)
├── worldfork/                   ← Python package
│   ├── server.py                ← Flask app (UI + API) on :5055
│   ├── orchestrator.py          ← run pipeline (HTTP control loop)
│   ├── bootstrap.py             ← seed-doc → graph → sim → ready
│   ├── perturbation_generator.py
│   ├── classifier.py            ← reads sim sqlite outputs, scores
│   ├── mood_perturbator.py
│   └── ui/                      ← v2 SPA (React via UMD/Babel)
│       ├── templates/WorldFork.html
│       └── static/{app,pages,tree,analysis,tweaks-panel}.jsx, api.js, styles.css
├── samples/                     ← scenario YAMLs + perturbation presets
├── runs/                        ← run artifacts (gitignored)
└── docs/

MiroShark (separate repo, sibling clone)
└── backend/                     ← Flask app on :5001 (Neo4j-backed)
                                   /fork-now, /branch-from-snapshot,
                                   /api/simulation/<id>/lineage, etc.
```

## Setup

**Prereqs**: Python 3.11+, [uv](https://docs.astral.sh/uv/), an [OpenRouter](https://openrouter.ai/) key, and the [MiroShark repo](https://github.com/aaronjmars/MiroShark) cloned alongside this one (`../MiroShark/`).

```bash
# 1. WorldFork
uv sync

# 2. MiroShark (sibling)
cd ../MiroShark/backend && uv sync && cp ../.env.example ../.env  # add your OPENROUTER_API_KEY
```

## Running

Three processes. MiroShark first (it's what WorldFork talks to), then WorldFork.

```bash
# Terminal 1 — MiroShark backend on :5001
cd ../MiroShark/backend && uv run python run.py

# Terminal 2 — WorldFork server on :5055
WF_ORCHESTRATOR_PYTHON="$(cd ../MiroShark/backend && uv run which python)" \
    uv run python worldfork/server.py
```

Open <http://localhost:5055>, click **▶ Start ensemble**.

A run takes ~10 min and ~$1 in OpenRouter:

| Phase | Time |
|---|---|
| Graph build (Neo4j ontology + entity extraction) | ~2 min |
| Simulation create + profile prep | ~2 min |
| Parent runs r0→r4 | ~1 min |
| 8 children fork at r4, run r4→r20 in parallel | ~3 min |
| Classifier sweeps each branch | ~1 min |
| Manifest written | — |

The UI polls every 3s and updates as branches complete. The orchestrator log lives at `runs/demo_<timestamp>_<id>.log`.

## Configuration

Environment variables (all optional):

| Var | Default | What |
|---|---|---|
| `WF_PORT` | `5055` | port |
| `WF_BACKEND` | `http://localhost:5001` | MiroShark URL |
| `WF_ORCHESTRATOR_PYTHON` | `sys.executable` | Python that runs the orchestrator subprocess (must have httpx + yaml — usually MiroShark's venv) |
| `WF_DEMO_SCENARIO` | `samples/ftx_collapse_scenario.yaml` | scenario for the Start button |
| `WF_DEMO_NUM_BRANCHES` | `8` | branches per primary fork |

## Development

```bash
# Run tests
uv run pytest worldfork/tests/

# Run orchestrator standalone (without the UI)
uv run python worldfork/orchestrator.py samples/ftx_collapse_scenario.yaml \
    --num-branches 8 --branch-timeout 1800
```

The UI is React via in-browser Babel — no Node build step. Edit `worldfork/ui/static/*.jsx` and hard-refresh the browser.

## License

AGPL-3.0
