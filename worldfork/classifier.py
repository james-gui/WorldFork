"""Outcome classifier — reads a finished simulation and returns a structured row.

Phase 1 deliverable: takes a sim directory + a schema YAML, calls the classifier
LLM once per run, returns a JSON dict matching the schema's outcome variables.

The classifier reads two sources:
  - The platform's sqlite DB (posts + comments + likes/dislikes)
  - events.jsonl (agent_decision events with parsed actions)

It does NOT read agent profiles, the knowledge graph, or per-agent belief
snapshots — those are signals we'll layer in if Layer-3 testing shows the
post stream alone is insufficient.
"""

from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from openai import OpenAI


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

@dataclass
class OutcomeVar:
    name: str
    description: str
    type: str           # "bool" | "int" | "float" | "str"
    range: list | None = None


def load_schema(path: str | Path) -> dict:
    """Load a scenario YAML; returns the parsed dict (not validated yet)."""
    with open(path) as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_posts(sim_dir: Path, platform: str, max_posts: int = 500) -> list[dict]:
    """Read posts from the platform's sqlite DB."""
    db = sim_dir / f"{platform}_simulation.db"
    if not db.exists():
        return []
    conn = sqlite3.connect(str(db))
    rows = conn.execute(
        "SELECT post_id, user_id, content, created_at, "
        "       COALESCE(num_likes, 0), COALESCE(num_dislikes, 0) "
        "FROM post ORDER BY post_id LIMIT ?",
        (max_posts,),
    ).fetchall()
    conn.close()
    return [
        {"post_id": r[0], "user_id": r[1], "content": r[2],
         "created_at": r[3], "likes": r[4], "dislikes": r[5]}
        for r in rows
    ]


def load_comments(sim_dir: Path, platform: str, max_comments: int = 500) -> list[dict]:
    """Read comments from the platform's sqlite DB."""
    db = sim_dir / f"{platform}_simulation.db"
    if not db.exists():
        return []
    conn = sqlite3.connect(str(db))
    rows = conn.execute(
        "SELECT comment_id, post_id, user_id, content, created_at, "
        "       COALESCE(num_likes, 0), COALESCE(num_dislikes, 0) "
        "FROM comment ORDER BY comment_id LIMIT ?",
        (max_comments,),
    ).fetchall()
    conn.close()
    return [
        {"comment_id": r[0], "post_id": r[1], "user_id": r[2], "content": r[3],
         "created_at": r[4], "likes": r[5], "dislikes": r[6]}
        for r in rows
    ]


def render_corpus(posts: list[dict], comments: list[dict],
                  max_chars: int = 80_000) -> str:
    """Render posts + comments into a readable text blob for the LLM."""
    lines = [f"=== POSTS ({len(posts)}) ==="]
    for p in posts:
        lines.append(
            f"[Post #{p['post_id']} u{p['user_id']} +{p['likes']}/-{p['dislikes']}] "
            f"{p['content']}"
        )
    if comments:
        lines.append(f"\n=== COMMENTS ({len(comments)}) ===")
        for c in comments:
            lines.append(
                f"[Comment #{c['comment_id']} u{c['user_id']} on post {c['post_id']} "
                f"+{c['likes']}/-{c['dislikes']}] {c['content']}"
            )
    text = "\n".join(lines)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[…truncated]"
    return text


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

def _build_prompt(corpus: str, outcomes: list[dict]) -> str:
    specs = []
    for o in outcomes:
        s = f"  - {o['name']} ({o['type']}): {o['description']}"
        if o.get("range") is not None:
            s += f"  [valid range: {o['range']}]"
        specs.append(s)

    return f"""You are an outcome classifier reading a finished agent-based simulation.
Read the simulation data below carefully, then answer each outcome question.

CRITICAL RULE — distinguish "evidence of absence" from "absence of evidence":

For EACH variable INDEPENDENTLY, return:
  - the requested value (true/false/number), ONLY if the data CLEARLY ADDRESSES
    that specific topic and supports that answer.
  - null, if the data is SILENT on the topic — i.e. the topic isn't meaningfully
    discussed in any post or comment.
  - null, if the answer is genuinely ambiguous.

For binaries: do NOT default to false just because the topic isn't mentioned.
"No one talked about BlackRock" is null, not false. "Posts discussed BlackRock
and concluded they didn't engage" is false. Conflating these corrupts
downstream probabilities.

For numerics: return 0 only if the schema explicitly says to use 0 as the
"no data" sentinel; otherwise return null.

OUTCOME VARIABLES:
{chr(10).join(specs)}

SIMULATION DATA:
{corpus}

Output ONLY valid JSON in this exact shape (no markdown, no extra prose):
{{
  "outcomes": {{ "<variable_name>": <value>, ... }},
  "reasoning": "<2-3 sentence summary of how you decided, including which variables you returned null for and why>"
}}
"""


def _make_client() -> OpenAI:
    """Build an OpenAI client pointed at the configured classifier provider."""
    api_key = (os.environ.get("SMART_API_KEY")
               or os.environ.get("OPENAI_API_KEY"))
    base_url = (os.environ.get("SMART_BASE_URL")
                or os.environ.get("OPENAI_API_BASE_URL"))
    if not api_key:
        raise RuntimeError(
            "No API key found. Set SMART_API_KEY or OPENAI_API_KEY in the environment."
        )
    return OpenAI(api_key=api_key, base_url=base_url)


def _parse_json_response(text: str) -> dict:
    """Strip markdown fences if present, parse JSON."""
    text = text.strip()
    if text.startswith("```"):
        # Remove ```json or ``` fences
        parts = text.split("```")
        if len(parts) >= 2:
            inner = parts[1]
            if inner.lstrip().startswith("json"):
                inner = inner.split("\n", 1)[1] if "\n" in inner else inner[4:]
            text = inner.strip()
    return json.loads(text)


def classify(sim_dir: str | Path, schema_path: str | Path,
             model: str | None = None,
             temperature: float = 0.0,
             platform: str | None = None) -> dict:
    """Run the classifier on one finished sim. Returns a dict with `outcomes` + `reasoning`.

    Args:
        sim_dir: path to a MiroShark simulation output directory.
        schema_path: path to a scenario YAML (or any YAML with `outcomes:` and optional `simulation.platform`).
        model: override classifier model. Defaults to SMART_MODEL_NAME from env,
               then `google/gemini-3.1-flash-lite-preview`.
        temperature: sampling temperature; 0 for the standard noise-floor test.
        platform: override which platform to read from. Defaults to schema['simulation']['platform']
                  or 'reddit'.
    """
    sim_dir = Path(sim_dir)
    schema = load_schema(schema_path)

    plat = platform or (schema.get("simulation") or {}).get("platform") or "reddit"
    posts = load_posts(sim_dir, plat)
    comments = load_comments(sim_dir, plat)
    corpus = render_corpus(posts, comments)

    if not posts:
        # Don't waste an LLM call on an empty corpus.
        return {
            "outcomes": {o["name"]: None for o in schema["outcomes"]},
            "reasoning": f"No posts found for platform '{plat}' in {sim_dir}.",
            "_meta": {"posts": 0, "comments": 0, "platform": plat,
                      "model": model, "temperature": temperature},
        }

    prompt = _build_prompt(corpus, schema["outcomes"])

    client = _make_client()
    chosen_model = (model
                    or os.environ.get("SMART_MODEL_NAME")
                    or "google/gemini-3.1-flash-lite-preview")

    resp = client.chat.completions.create(
        model=chosen_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    raw = resp.choices[0].message.content
    parsed = _parse_json_response(raw)

    # Add meta for debugging
    parsed["_meta"] = {
        "posts": len(posts),
        "comments": len(comments),
        "platform": plat,
        "model": chosen_model,
        "temperature": temperature,
        "tokens_in": getattr(resp.usage, "prompt_tokens", None),
        "tokens_out": getattr(resp.usage, "completion_tokens", None),
    }
    return parsed


# ---------------------------------------------------------------------------
# CLI for ad-hoc runs
# ---------------------------------------------------------------------------

def _main():
    import argparse
    p = argparse.ArgumentParser(description="Classify a finished MiroShark simulation against a schema.")
    p.add_argument("sim_dir", help="Path to a sim_<id> directory")
    p.add_argument("schema", help="Path to a scenario YAML")
    p.add_argument("--platform", default=None, help="Override platform (reddit/twitter/polymarket)")
    p.add_argument("--model", default=None, help="Override classifier model")
    p.add_argument("--temperature", type=float, default=0.0)
    p.add_argument("--repeat", type=int, default=1, help="Run N times (Layer-1 noise floor)")
    args = p.parse_args()

    # Load .env from common locations
    try:
        from dotenv import load_dotenv
        # Try the v1 .env, then the original MiroShark .env
        for env_path in [
            Path(__file__).parent.parent / ".env",
            Path("/Users/james/Documents/WorldFork/short/MiroShark/.env"),
        ]:
            if env_path.exists():
                load_dotenv(env_path)
                break
    except ImportError:
        pass

    for i in range(args.repeat):
        result = classify(
            args.sim_dir, args.schema,
            model=args.model,
            temperature=args.temperature,
            platform=args.platform,
        )
        print(f"\n=== run {i+1}/{args.repeat} ===")
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    _main()
