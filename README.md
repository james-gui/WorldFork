# WorldFork

WorldFork is an explainable, recursively branching social-simulation platform. A user creates a root scenario called a **Big Bang**, and the system initializes a structured simulated society made of population archetypes, dynamic cohort states, hero agents, news/media channels, social-media feeds, event queues, and sociology rules. The simulation advances in configurable ticks. At each tick, cohort and hero agents see only the information visible to them, decide what to say or do through structured tool calls, and update the simulated social world. At meaningful decision points, a **God-agent** can create alternate timelines — every timeline can branch again, forming a recursive tree of possible futures. The full system includes a Python backend with async job queues, provider abstraction (OpenRouter default), rate-limit-aware branching scheduler, source-of-truth taxonomies, sociology update layer, recursive branch engine, optional Zep memory integration, and polished Next.js UI.

## Quickstart

```bash
cp .env.example .env
vim .env   # paste real OPENROUTER_API_KEY and ZEP_API_KEY

make build
make up
make migrate
make seed
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Web | http://localhost:3000 |

## Frontend Dev Commands

```bash
cd apps/web

# Start the Next.js dev server (port 3000)
pnpm dev

# Generate typed API client from the FastAPI OpenAPI schema
# (requires the backend to be running at http://localhost:8000)
pnpm codegen:api

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Reference

- **Implementation plan**: `/home/hacktech-collab/.claude/plans/implement-this-plan-in-valiant-toast.md`
- **PRD**: `prd-do-not-delete/prd.md`
