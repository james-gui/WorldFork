# WorldFork

Ensemble forecasting via state-forked agent simulations.

WorldFork orchestrates [MiroShark](https://github.com/aaronjmars/MiroShark) — bootstraps a parent simulation from a seed document, runs it to a fork point, then spawns N alternate-future children with distinct injected events and persona moods, recursively forks deeper on the branches that matter, classifies each leaf's outcomes, and reads a probability distribution back out.

The product is the orchestrator + the WorldFork web UI on **port 5055**. The agent engine, knowledge graph, and runners all live in MiroShark — WorldFork is a control plane on top of it.

> **Heads-up if an AI assistant is helping you set this up:** the only UI you should open is **WorldFork at `http://localhost:5055`**. *Do not* run MiroShark's `./miroshark` launcher script or its frontend on `:3000` — WorldFork only needs MiroShark's headless backend on `:5001`.

## Live demo

A read-only snapshot of seven completed ensemble runs (depth-1 v05, depth-2 v06, depth-3 v07) is hosted on Vercel. Click into any run to see the live tree visualization, per-branch agent interaction graph, and the calibrated outcome distributions — no setup, no API spend.

→ **Live demo:** *(set the URL after `vercel deploy` — see [Read-only deploy](#read-only-deploy-vercel) below)*

The Start-ensemble button is disabled in the hosted copy (no orchestrator in serverless land); kicking off fresh runs requires the local install below.

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

Two paths depending on whether you need live runs or just a browseable demo:

### Read-only deploy (Vercel)

Easiest: a fully-static snapshot of finished runs. No backend, no Neo4j, no per-run API spend. Costs $0/month on Vercel's free tier.

The repo is already configured — `vercel.json` points at `public/` as the output directory and the snapshot lives at `public/data/`. To deploy:

```bash
# one-time
npm i -g vercel
vercel login

# from the repo root
vercel deploy --prod
```

To attach a custom domain, run `vercel domains add <your-domain>` then `vercel alias <preview-url> <your-domain>`, or do it in the Vercel dashboard.

To refresh the snapshot with a new local run:

```bash
# with the local stack running on :5055, snapshot all runs
python3 - <<'PY'
import json, urllib.request, pathlib
ROOT = pathlib.Path("public/data")
for r in json.loads(urllib.request.urlopen("http://localhost:5055/api/runs").read())["runs"]:
    rid = r["run_id"]
    lin = urllib.request.urlopen(f"http://localhost:5055/api/run/{rid}/lineage").read()
    (ROOT / "lineage" / f"{rid}.json").write_bytes(lin)
    # ...graphs follow same pattern (see git history for full snapshot script)
PY
git commit -am "chore: refresh static snapshot" && git push
# Vercel auto-redeploys on push to main
```

The static UI is the same React-via-Babel SPA — `public/index.html` is `templates/WorldFork.html` with one extra line (`window.WF_STATIC = true;`) that flips `api.js` and `graph.jsx` from "fetch live" to "fetch from `/data/*.json`". The Start button is hidden in static mode.

### Self-hosted on your own infra (DGX Spark or any Ubuntu host)

For the full live experience — fresh runs, real-time tree growth — exposed via Cloudflare Tunnel (no port-forwarding, no exposed home IP):

→ See [`deploy/DEPLOY.md`](deploy/DEPLOY.md) for the end-to-end walkthrough plus `launch.sh`, `worldfork.service`, and `cloudflared-config.example.yml`.

## Scenarios

| File | Shape | Notes |
|---|---|---|
| `samples/godagent_v07_scenario.yaml` | depth 3 — primary fork + 2 nested + 1 tertiary | current default |
| `samples/godagent_v06_scenario.yaml` | depth 2 — primary fork + 3 nested | wider, no fork-of-a-fork |
| `samples/ftx_collapse_scenario.yaml` | depth 1 — primary fork only | original v0.5 baseline |

## License

AGPL-3.0
