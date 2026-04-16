# MiroShark Model & Performance Findings

Session: 2026-04-15. Two full simulation runs compared across different model configurations.

## Configurations Tested

### Config A — "Speed Stack" (all Gemini)

| Role | Model | Price |
|------|-------|-------|
| Smart | `google/gemini-2.5-flash` | $0.30/M |
| Default | `google/gemini-2.0-flash-001` | $0.10/M |
| NER | `google/gemini-2.0-flash-001` | $0.10/M |
| OASIS | `google/gemini-2.0-flash-001` (shared with default) | $0.10/M |
| Web | `perplexity/sonar` | $1.00/M |

### Config B — "Diverse" (multi-provider)

| Role | Model | Price |
|------|-------|-------|
| Smart | `google/gemini-2.5-pro` | $1.25/M |
| Default | `deepseek/deepseek-chat-v3-0324` | $0.26/M |
| NER | `google/gemini-2.0-flash-001` | $0.10/M |
| OASIS | `openai/gpt-5-nano` | $0.05/M |
| Web | `google/gemini-2.0-flash-001:online` | $0.10/M + $0.02/search |

---

## Head-to-Head Results

Both runs used the same input document (Polymarket valuation analysis), same simulation requirement, 79 agents, 40 rounds, 3 platforms (Twitter, Reddit, Polymarket).

| Metric | Config A | Config B |
|--------|----------|----------|
| **Total clock time** | ~18 min | ~65 min |
| **Sim loop time** | 354s (6 min) | 2,579s (43 min) |
| **Total cost** | ~$0.90 | TBD (higher due to DeepSeek volume) |
| **LLM calls** | 291 | 244 |
| **LLM errors** | 383 (Gemini empty-parts, all recovered) | 0 |

### Pipeline Phase Breakdown

| Phase | Config A | Config B | Notes |
|-------|----------|----------|-------|
| Profile gen | 184s wall, 8.4s avg | 396s wall, 21.2s avg | DeepSeek 2.5x slower |
| Config gen | 83s (8 calls) | 524s (8 calls, **246s max**) | DeepSeek thinking mode kills structured output |
| Web enrichment | 197s (43 calls, Sonar) | 81s (17 calls, Flash:online) | Fewer calls but 220K input tokens |
| NER | 234s (91 calls) | 213s (80 calls) | Both use Gemini Flash, similar |
| Report gen | 62s (112K input tok) | 186s (158K input tok) | 2.5 Pro slower but higher quality |
| Interviews | 155s (2.5 Flash) | 270s (DeepSeek) | DeepSeek 33.7s avg vs 15.5s |
| Round memory | 45s | 177s | DeepSeek 7.8s avg vs 1.6s |

### Simulation Quality

| Metric | Config A | Config B |
|--------|----------|----------|
| Twitter posts | 33 | 65 |
| Twitter DO_NOTHING | **180 (68%)** | **0 (0%)** |
| Twitter quote posts | 0 | 19 |
| Reddit posts | 37 | 30 |
| Reddit comments | 122 | 62 |
| Polymarket buys | 85 | 70 |
| Polymarket sells | 13 | 0 |
| Belief polarization | Higher (1.1-1.3) | Lower (0.1-0.2) |

**Key quality finding:** GPT-5 Nano produces dramatically more engaged agents on Twitter (zero idle actions, more quote-posts) while Gemini Flash agents were idle 68% of the time. Reddit and Polymarket showed less difference.

---

## Bugs Fixed During Session

### 1. Gemini "empty parts" error (383 per run)

**Root cause:** CAMEL/OASIS memory system occasionally produces messages with empty/null content. OpenAI tolerates this; Gemini rejects with `INVALID_ARGUMENT: must include at least one parts field`.

**Fix:** Override `_aget_model_response` in `SocialAgent` to filter out empty-content messages before they reach the model backend.

**File:** `backend/wonderwall/social_agent/agent.py`

### 2. Ontology generation 500 error with Gemini 2.5 Pro

**Root cause:** Gemini 2.5 Pro uses `<think>` reasoning tokens that count toward `max_tokens`. With `max_tokens=4096`, the thinking consumed most of the budget, leaving the actual JSON response truncated. `chat_json()` then failed to parse the incomplete JSON.

**Fix:** Bumped `max_tokens` from 4096 to 8192 in `ontology_generator.py`.

**File:** `backend/app/services/ontology_generator.py`

---

## Optimizations Implemented

### 1. Web enrichment parallelism fix

**Problem:** `WebEnricher` shared a single `LLMClient` instance across all profile generation threads. The OpenAI HTTP client serialized requests, reducing effective parallelism to 1.1x (43 calls, 197s wall, 197s compute).

**Fix:** Create a new `LLMClient` per call instead of lazy-init once.

**File:** `backend/app/services/web_enrichment.py`

### 2. Route non-reasoning tasks to fast model

**Problem:** `GraphToolsService` used the smart model (`create_smart_llm_client()`) for everything including interviews, agent selection, question generation, and summaries. These are mechanical tasks that don't need expensive reasoning.

**Fix:** Added `fast_llm` property using `create_llm_client()` (default model). Routed interviews, agent selection, question generation, interview summaries, and sub-query generation to `fast_llm`. Smart model reserved for external callers only.

**File:** `backend/app/services/graph_tools.py`

### 3. Cap interview output tokens

**Problem:** `_interview_single_agent_llm` used `max_tokens=2048`, generating ~2K tokens per interview (19.5K total for 10 interviews). Excessive for report consumption.

**Fix:** Capped `max_tokens` to 1024.

**File:** `backend/app/services/graph_tools.py`

### 4. Slim agent selection prompt

**Problem:** `_select_agents_for_interview` sent full profile dicts with bios as `json.dumps(indent=2)` — 20,660 input tokens for 79 agents just to pick 8 for interview.

**Fix:** Replaced with compact one-line-per-agent format: `"0: Steve Cohen — Hedge Fund Manager [Markets, Trading]"`. Reduces to ~2K tokens.

**File:** `backend/app/services/graph_tools.py`

### 5. Cap report previous-section context

**Problem:** `_generate_section_react` passed up to 4000 chars per previous section with no total cap. By section 14, previous context alone was enormous.

**Fix:** Total previous context capped at 6000 chars, divided equally across sections. Note: this turned out to be only part of the problem — tool results in the ReACT conversation history are the larger contributor to context bloat (see "Still Open" below).

**File:** `backend/app/services/report_agent.py`

### 6. Added OASIS_MODEL_NAME config

**Problem:** OASIS/CAMEL agents and the default `LLMClient` (profiles, config gen, etc.) both read `LLM_MODEL_NAME`. No way to use different models for the sim loop vs. pre-sim pipeline.

**Fix:** Added `OASIS_MODEL_NAME` env var. When set, the simulation runner uses it instead of `LLM_MODEL_NAME` for CAMEL model creation. Falls back to `LLM_MODEL_NAME` when not set.

**Files:** `backend/app/config.py`, `backend/scripts/run_parallel_simulation.py`

---

## Key Learnings

### Model speed vs. quality tradeoffs

- **Gemini 2.0 Flash** is the fastest for everything (8.4s avg profile gen, 1.6s memory compaction) but produces passive agents (68% DO_NOTHING on Twitter)
- **DeepSeek v3** produces diverse, engaged behavior but is 2-7x slower and has wild latency variance (p50=15s, p90=50s for profiles; config gen had a 246s outlier)
- **GPT-5 Nano** is the best OASIS model tested — zero idle agents, cheap ($0.05/M), fast sim loop
- **Gemini 2.5 Pro** produces high-quality reports but `<think>` tokens inflate output token counts and can cause truncation if `max_tokens` isn't generous

### Web search: Sonar vs :online

| | Perplexity Sonar | Gemini Flash:online |
|---|---|---|
| Calls (same sim) | 43 | 17 |
| Input tokens | 13,545 | 219,918 |
| Output tokens | 14,584 | 7,431 |
| Wall time | 197s | 81s |
| Mechanism | Native search, returns text | Exa injects full web pages into prompt |
| Latency per call | 4.6s avg | 4.8s avg |

**Finding:** `:online` uses fewer calls but massively inflates input tokens because Exa injects raw web page content. For MiroShark's short entity research queries, Sonar is more token-efficient. The `:online` approach may be cheaper per-call ($0.02 search fee vs Sonar's per-token cost) but the inflated input tokens offset the savings.

### Profile generation parallelism

The `ThreadPoolExecutor(max_workers=15)` is already in place but actual concurrency maxes at 4-7x because:
1. Web enrichment (called inside each profile gen thread) was serialized due to shared `LLMClient` — **fixed**
2. Neo4j graph search is I/O-bound and single-connection
3. OpenRouter rate limits may throttle concurrent requests

After fixing the web enricher, expect ~6-8x parallelism.

### NER call count is correct

91 NER calls in Config A seemed high but is by design:
- 22 calls = initial document chunk processing
- 69 calls = `graph_memory_updater` feeding simulation activity back into the knowledge graph via `storage.add_text()` during the sim loop

### Report agent context bloat

The previous-section cap (optimization #5) only addresses part of the problem. The larger contributor is the ReACT loop's conversation history: each tool call appends observation results to the message list, and these accumulate across iterations. The system prompt (tool descriptions, ontology, simulation requirement) is ~4-5K tokens per call on its own.

**Potential fix (not implemented):** Truncate tool result observations in the ReACT loop to a max size, or summarize them before appending.

---

## Still Open (Not Implemented)

1. **Route profiles, config gen, memory compaction to Gemini Flash while keeping DeepSeek only for OASIS** — the `fast_llm` in `graph_tools.py` routes to `LLM_MODEL_NAME` (the default model), which is DeepSeek in Config B. Need a dedicated "mechanical tasks" model config or hardcode Gemini Flash for these.

2. **Truncate tool results in ReACT loop** — report agent appends full InsightForge/PanoramaSearch results (can be 10K+ tokens) to the conversation. Capping at 2-3K per observation would dramatically reduce input tokens.

3. **Trim profile persona length** — currently 800-1200 words. The full persona is injected as the OASIS agent system prompt on every single LLM call (every agent action, every round). Cutting to 400-600 words would save ~1.2M input tokens per sim in the OASIS loop. Tradeoff: unclear if the extra detail (blind spots, "what would change their mind") affects agent behavior.

4. **Twitter DO_NOTHING rate** — Gemini Flash agents are idle 68% of the time. This is either a prompt issue (the OASIS action prompt doesn't encourage engagement) or a model behavior difference. GPT-5 Nano doesn't have this problem.

5. **Web enrichment: Sonar vs :online cost analysis** — the `:online` suffix inflates input tokens (220K vs 14K). Need to test with `max_results=1` plugin config to reduce injected web content, or just use Sonar for this task.

6. **DeepSeek config gen outliers** — one call took 246s. The `simulation_config_generator` asks for complex structured JSON; DeepSeek's thinking mode generates long reasoning chains. Adding a timeout or routing to Gemini Flash would fix this.

---

## Recommended Config C — "Best of Both"

Based on findings, the optimal configuration would be:

```env
# Pre-sim pipeline (profiles, config, NER, web) — fast model
LLM_MODEL_NAME=google/gemini-2.0-flash-001

# OASIS sim loop — engaged, diverse agents
OASIS_MODEL_NAME=openai/gpt-5-nano

# Smart model — reports, ontology
SMART_MODEL_NAME=google/gemini-2.5-pro

# NER — fast, mechanical
NER_MODEL_NAME=google/gemini-2.0-flash-001

# Web search — token-efficient
WEB_SEARCH_MODEL=perplexity/sonar
```

Expected: ~20 min total, zero idle agents, high-quality reports, ~$1.00-1.50/run.
