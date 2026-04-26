# Deploying WorldFork on a Linux host (DGX / Ubuntu / DGX OS)

End-to-end walkthrough for putting WorldFork behind your own custom domain via Cloudflare Tunnel. Built around running on an NVIDIA DGX Spark (128 GB unified memory, plenty of headroom for 12+ concurrent sim subprocesses) but works on any Ubuntu host.

## What you'll end up with

```
https://worldfork.<your-domain>
        │
        ▼
Cloudflare Tunnel  ──→  http://<dgx>:5055  (WorldFork UI + API)
                                │
                                ▼
                        http://localhost:5001  (MiroShark backend)
                                │
                                ▼
                        Neo4j (Aura Free or local Docker)
```

No port-forwarding, no exposed home IP, no inbound firewall rules. Cloudflare's edge does TLS termination and routes traffic into the tunnel.

## 0. Prereqs

- DGX Spark (or any Ubuntu 22.04+ host) with `git`, `curl`, `lsof`, `python3.11+`, `uv`, `docker` (if you want local Neo4j)
- A domain you control, with its DNS managed by Cloudflare (free tier is fine)
- An [OpenRouter](https://openrouter.ai/) API key
- A Neo4j instance — either an [Aura Free](https://neo4j.com/cloud/aura/) tile or a local Docker one (the DGX has plenty of RAM for it)

## 1. Clone both repos as siblings

```bash
mkdir -p ~/worldfork && cd ~/worldfork
git clone https://github.com/james-gui/WorldFork.git
git clone https://github.com/aaronjmars/MiroShark.git
```

Layout:
```
~/worldfork/
├── WorldFork/    ← this repo
└── MiroShark/    ← sibling, must exist at ../MiroShark relative to WorldFork
```

## 2. Sync both venvs

```bash
cd ~/worldfork/WorldFork && uv sync
cd ~/worldfork/MiroShark/backend && uv sync
```

## 3. Optional — local Neo4j in Docker (skip if using Aura Free)

```bash
docker run -d --name neo4j \
    -p 7687:7687 -p 7474:7474 \
    -e NEO4J_AUTH=neo4j/worldfork \
    -v $HOME/neo4j-data:/data \
    --restart unless-stopped \
    neo4j:5-community
```

## 4. Configure MiroShark .env

```bash
cd ~/worldfork/MiroShark
cp .env.example .env
$EDITOR .env
```

Fill in (using local Neo4j as the example):

```
LLM_PROVIDER=openai
LLM_API_KEY=sk-or-...                                  # OpenRouter key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL_NAME=qwen/qwen3.5-flash-02-23

EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=sk-or-...
EMBEDDING_BASE_URL=https://openrouter.ai/api
EMBEDDING_MODEL=openai/text-embedding-3-large
EMBEDDING_DIMENSIONS=768

RERANKER_ENABLED=false                                  # leave off for now

NEO4J_URI=bolt://localhost:7687                         # or your Aura URI
NEO4J_USER=neo4j
NEO4J_PASSWORD=worldfork
```

## 5. Smoke-test locally

```bash
cd ~/worldfork/WorldFork
./deploy/launch.sh
```

You should see:
```
[launch] MiroShark backend healthy on :5001
[launch] WorldFork ready at http://localhost:5055
```

`curl http://localhost:5055/` should return HTML. If you're sitting at the DGX, open <http://localhost:5055> in a browser to verify the UI renders.

If anything's wrong, check `deploy/logs/miroshark-backend.log` and `deploy/logs/wf-server.log`.

Stop with `./deploy/stop.sh`.

## 6. Cloudflare Tunnel — public URL on your domain

Install `cloudflared` (DGX Spark is arm64):

```bash
curl -L -o cloudflared.deb \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
```

Authenticate + create the tunnel:

```bash
cloudflared tunnel login            # opens a browser to authorize
cloudflared tunnel create worldfork # prints UUID + creds path
```

Route DNS — replace `<your-domain>`:

```bash
cloudflared tunnel route dns worldfork worldfork.<your-domain>
```

Cloudflare will create a CNAME for you automatically.

Drop the config:

```bash
mkdir -p ~/.cloudflared
cp ~/worldfork/WorldFork/deploy/cloudflared-config.example.yml ~/.cloudflared/config.yml
$EDITOR ~/.cloudflared/config.yml
# replace REPLACE_WITH_TUNNEL_UUID, REPLACE_WITH_YOUR_USERNAME, REPLACE_WITH_YOUR_DOMAIN
```

Verify:

```bash
cloudflared tunnel run worldfork    # foreground, ctrl-C to stop
```

In another shell on a different machine:

```bash
curl https://worldfork.<your-domain>/    # should return WorldFork's HTML
```

Once verified, install as a system service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## 7. Make WorldFork itself a system service

```bash
sudo cp ~/worldfork/WorldFork/deploy/worldfork.service /etc/systemd/system/
sudo $EDITOR /etc/systemd/system/worldfork.service
# replace REPLACE_WITH_YOUR_USERNAME (3 occurrences)
sudo systemctl daemon-reload
sudo systemctl enable --now worldfork
```

Check status:

```bash
systemctl status worldfork
journalctl -u worldfork -f          # live logs
```

## 8. Done

Visit `https://worldfork.<your-domain>` from anywhere. The DGX serves it.

If the box reboots, both services come back automatically (cloudflared + worldfork). If the launcher fails (e.g. MiroShark backend dies), systemd restarts it after 10 s.

## Cost notes

| Item | Cost |
|---|---|
| DGX Spark idle electricity | low — GB10 has aggressive idle modes |
| Cloudflare Tunnel | $0 (free tier) |
| Custom domain | whatever you already pay |
| Per-run OpenRouter | ~$2/run, only when someone clicks Start |
| Aura Free OR local Neo4j | $0 |

Per-run cost is the only variable. For hackathon judging traffic this is negligible. If you need a hard cap, set a daily spending limit in your OpenRouter dashboard.

## Troubleshooting

**`launch.sh` says MiroShark venv not found** — run `cd ../MiroShark/backend && uv sync` first.

**Cloudflare tunnel returns 502** — WorldFork server isn't running locally. Check `systemctl status worldfork`, then `tail deploy/logs/wf-server.log`.

**Run hangs in bootstrap "graph build"** — Neo4j is probably unreachable. Test: `python3 -c "from neo4j import GraphDatabase; GraphDatabase.driver('$NEO4J_URI', auth=('$NEO4J_USER','$NEO4J_PASSWORD')).verify_connectivity()"` from the MiroShark venv.

**OpenRouter 401** — bad/missing API key. Check that **both** `LLM_API_KEY` and `EMBEDDING_API_KEY` are set in `MiroShark/.env` (same key, two variables).

**Custom domain returns "DNS_PROBE_FINISHED_NXDOMAIN"** — Cloudflare DNS hasn't propagated yet (usually < 60s). Confirm the CNAME exists in your Cloudflare DNS dashboard.
