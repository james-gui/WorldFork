# WorldFork Backend Test Coverage

Three layers, each with a clear scope. Run them in this order in CI; later
layers depend on earlier ones being green.

| Layer        | Location                       | Count | Approx wall time |
| ------------ | ------------------------------ | -----:| ----------------:|
| Unit         | `backend/tests/unit/`          | ~399  | ~11 s            |
| Integration  | `backend/tests/integration/`   | ~150  | ~80 s (parallel) |
| E2E          | `backend/tests/e2e/`           |  ~25  | ~100 s (serial)  |

CI hint: run unit + integration first, then e2e. Tests marked
`live_openrouter`, `live_zep`, or `requires_broker` are opt-in.

## Layer 1 — Unit (`backend/tests/unit/`)

Scope: pure-function and per-module logic, no DB, no network.

| Module                       | Coverage                                                      |
| ---------------------------- | ------------------------------------------------------------- |
| `test_active_selection.py`   | PRD §11.2 activity-score scoring                              |
| `test_attention.py`          | §12.2 attention vectorised math                               |
| `test_belief.py`             | §12.4 belief drift + bounded kernel                           |
| `test_branch_policy.py`      | §13.5 max active / depth / per-tick / cooldown                |
| `test_celery_setup.py`       | broker URL parse, queue declaration, JSON-only serializer     |
| `test_divergence.py`         | divergence-score helper                                       |
| `test_export.py`             | run-folder zip / re-import + Merkle round-trip                |
| `test_expression.py`         | §12.3 + §12.5 spiral-of-silence gate                          |
| `test_god_agent.py`          | invariants on God-agent payload (spawn-active w/o delta etc.) |
| `test_graphs.py`             | NetworkX multiplex layers + JSONL persist                     |
| `test_ledger.py`             | atomic write, Merkle chain, manifest                          |
| `test_memory_local.py`       | LocalMemoryProvider deque / context                           |
| `test_memory_zep.py`         | ZepMemoryProvider degraded flag + fallback routing            |
| `test_metrics.py`            | per-tick metric calculations                                  |
| `test_models.py`             | SQLAlchemy 2.0 typed models + composite-PK constraints        |
| `test_prompt_builder.py`     | §10.2 cohort/hero/god packet assembly                         |
| `test_provider_policy.py`    | `call_with_policy` orchestrator paths (mocked)                |
| `test_rate_limits.py`        | token-bucket Lua + concurrency cap                            |
| `test_schemas.py`            | every Pydantic schema in §9.1–9.9 + invariants                |
| `test_simulation_metrics.py` | dominant-emotion, mobilisation-risk computers                 |
| `test_smoke_celery.py`       | echo task round-trip via eager Celery (skips w/o Redis)       |
| `test_sot_loader.py`         | SoT directory loader + Merkle hash                            |
| `test_split_merge.py`        | §12.7 / §12.8 transactional split + merge                     |
| `test_thresholds.py`         | §12.6 mobilisation + complex-contagion threshold              |
| `test_tool_parser.py`        | §10.5 output-contract JSONSchema + repair                     |
| `test_trust.py`              | NetworkX DiGraph trust matrix                                 |
| `test_validators.py`         | clamp emotions / behaviors / population                       |
| `test_webhooks.py`           | webhook signing + delivery retry                              |
| `test_openrouter_live.py`    | opt-in (`live_openrouter`) — real OpenRouter ping             |
| `test_memory_zep_live.py`    | opt-in (`live_zep`) — real Zep healthcheck                    |

## Layer 2 — Integration (`backend/tests/integration/`)

Scope: ORM + ASGI + branch-engine + initializer with mocked LLM + SQLite shadow.

| Module                          | Coverage                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| `test_api_runs.py`              | `/api/runs` CRUD + idempotency + export + SoT bundle       |
| `test_api_universes.py`         | `/api/universes/*` pause/resume/step/branch/lineage/etc.   |
| `test_api_multiverse.py`        | `/api/multiverse/{bb_id}` tree/dag/metrics/prune/compare   |
| `test_api_settings.py`          | settings GET/PATCH                                         |
| `test_api_jobs.py`              | jobs monitor (Celery `inspect()`-backed, mocked)           |
| `test_api_logs.py`              | logs query API                                             |
| `test_api_integrations.py`      | webhook + zep config endpoints                             |
| `test_branch_engine.py`         | recursive copy-on-write w/ all 4 BranchDelta kinds         |
| `test_initializer.py`           | initializer happy path + invalid output + Zep-disabled     |
| `test_lineage.py`               | tree builder, cache, get_descendants, prune                |
| `test_websockets.py`            | run/universe/jobs WS + cookie auth                         |

## Layer 3 — End-to-end (`backend/tests/e2e/`)

Scope: full ASGI app + DB + ledger + branch + (mocked) provider/Zep.
Mirrors PRD §27.3.

| Test file                                       | PRD ref      | Coverage                                                  |
| ----------------------------------------------- | ------------ | --------------------------------------------------------- |
| `test_smoke_full_run.py`                        | §27.3 #1, #4 | create → init → branch → multiverse tree → export         |
| `test_recursive_branch_e2e.py`                  | §27.3 #1     | root → child → grandchild lineage path of length 3        |
| `test_population_conservation_e2e.py`           | §27.3 #3     | `commit_split` conserves population; auditor clean        |
| `test_provider_fallback_e2e.py`                 | §27.3 #2     | primary 5xx → backoff retry; primary exhaust → fallback   |
| `test_zep_outage_fallback.py`                   | §27.3 #5     | 3 failures → degraded; further calls go to LocalMemory    |
| `test_idempotency_e2e.py`                       | §27.2        | `Idempotency-Key` dedupe + Redis SETNX guard              |
| `test_export_reimport_roundtrip.py`             | §27.3 #4     | seal 2 ticks → export → re-import → both verify clean     |
| `test_freeze_kill_e2e.py`                       | §27.3 #6     | pause/resume/kill lifecycle + 409 on illegal transitions  |
| `test_provider_rate_limit_fallback.py`          | §16.5        | RPM=1 token-bucket; second/third call wait or RateLimitError |
| `test_queue_dead_letter.py`                     | §27.2        | `route_dead_letter` LPUSH + LTRIM + safe on Redis errors  |

### Skips and opt-ins

| Test                                           | Marker             | Why it skips                                              |
| ---------------------------------------------- | ------------------ | --------------------------------------------------------- |
| `test_smoke_three_ticks_via_local_runner_skipped` | `requires_broker` | `simulation.local_runner.run_tick_locally` (B4-C) not yet implemented; skip cleanly so e2e is green on the implemented surface. |
| `test_initializer_live_openrouter`              | `live_openrouter` | Hits real OpenRouter; opt-in only.                        |
| `test_*_live` in unit/                          | `live_*`           | Hit real upstream services; opt-in only.                  |

## Markers

Defined in `pyproject.toml`. Use `-m` to filter:

```bash
pytest -m e2e                                 # e2e only
pytest -m "not slow and not live_openrouter"  # exclude long / live
pytest -m requires_broker                     # only broker-dependent (skipped if no broker)
```

| Marker             | Meaning                                                      |
| ------------------ | ------------------------------------------------------------ |
| `e2e`              | end-to-end test in `backend/tests/e2e/`                      |
| `slow`             | individually >5 s; consider filtering on tight CI            |
| `requires_broker`  | needs a running Celery broker; skips cleanly otherwise       |
| `requires_redis`   | needs a reachable Redis (mostly Celery smoke)                |
| `live_openrouter`  | hits live OpenRouter API (opt-in)                            |
| `live_zep`         | hits live Zep Cloud API (opt-in)                             |

## Running

```bash
# Full sweep:
make test-all
./scripts/run_tests.sh

# One layer at a time:
make test-unit
make test-integration
make test-e2e

# Layer + parallel + verbose:
.venv/bin/python -m pytest backend/tests/e2e -v
```

## CI integration

Recommended GitHub Actions order:

1. `lint` — ruff + mypy.
2. `make test-unit` — fast.
3. `make test-integration` — parallel, ~80 s.
4. `make test-e2e` — serial (DB isolation), ~100 s.
5. (Optional) opt-in stages for `live_openrouter` and `live_zep`.

A failing earlier layer should short-circuit the later ones to save runner
minutes.
