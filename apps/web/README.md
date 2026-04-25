# WorldFork — Web Frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui frontend for the WorldFork social simulation platform.

## Getting started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
# → http://localhost:3000

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Build for production
pnpm build
```

## Environment variables

Create a `.env.local` file (never commit it):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the FastAPI backend (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | WebSocket base URL of the FastAPI backend (default: `ws://localhost:8000`) |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open command palette |
| `g r` | Go to Run History |
| `g d` | Go to Dashboard |
| `g j` | Go to Jobs |
| `g s` | Go to Settings |
| `g l` | Go to Logs |
| `g n` | Go to New Big Bang wizard |

Shortcuts are suppressed when focus is inside an input, textarea, or select.

## Project structure

```
app/
  (app)/          # Authenticated shell (sidebar + topbar)
  (marketing)/    # Public landing page
components/
  chrome/         # Shell components (AppSidebar, TopBar, Breadcrumbs, etc.)
  dashboard/      # Simulation dashboard widgets
  multiverse/     # Recursive multiverse explorer
  network/        # Network graph (Sigma.js)
  ...
lib/
  api/            # openapi-fetch client + TanStack Query hooks
  ws/             # WebSocket client + hooks
  state/          # Zustand stores
  keyboard.ts     # Global keyboard shortcut hook
```
