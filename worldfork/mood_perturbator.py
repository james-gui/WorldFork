"""Persona / mood perturbation (Road B).

Modifies a child sim's agent profiles before /start fires, by appending a
private-inner-state paragraph to each agent's `persona` field. The runner
reads the modified profiles at startup and the new persona text becomes
part of every agent's system message — so it shapes behavior without
appearing in the social-media feed.

Why we modify `persona` rather than `bio`:
  - `persona` is the verbose character description that primarily drives
    the system message + decision-making. `bio` is shown publicly on the
    profile and to other agents, so editing it would leak the perturbation.
  - We want the mood to be PRIVATE (the agent's inner disposition), not
    visible to other agents. Appending to persona keeps it private.

Format we append:

    === PRIVATE INNER STATE (your perspective, not for public posting) ===
    <mood_text>

The framing makes clear to the LLM that this is internal context, not
something to quote verbatim — the agent should *act consistently with* it,
not paste it.
"""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Iterable

logger = logging.getLogger("worldfork.mood")

PERSONA_HEADER = (
    "\n\n=== PRIVATE INNER STATE (your perspective, not for public posting) ===\n"
)


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

def apply_mood_modifier_reddit(profiles_path: Path, mood_text: str) -> int:
    """Append mood_text to every agent's persona in reddit_profiles.json.

    Returns the number of profiles modified.
    """
    profiles = json.loads(profiles_path.read_text())
    if not isinstance(profiles, list):
        raise ValueError(f"expected a list of profiles in {profiles_path}")

    suffix = PERSONA_HEADER + mood_text.strip() + "\n"
    n = 0
    for p in profiles:
        if not isinstance(p, dict):
            continue
        existing = p.get("persona") or ""
        # Idempotency guard — don't double-append if function called twice
        if PERSONA_HEADER in existing:
            existing = existing.split(PERSONA_HEADER)[0].rstrip()
        p["persona"] = existing + suffix
        n += 1
    profiles_path.write_text(
        json.dumps(profiles, indent=2, ensure_ascii=False),
    )
    return n


def apply_mood_modifier_twitter(profiles_path: Path, mood_text: str) -> int:
    """Append mood_text to every agent's persona in twitter_profiles.csv.

    The Wonderwall Twitter format is CSV. We read, mutate the persona
    column, and write back.
    """
    rows: list[dict] = []
    with open(profiles_path, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    if "persona" not in fieldnames:
        raise ValueError(f"twitter profiles missing 'persona' column at {profiles_path}")

    suffix = PERSONA_HEADER + mood_text.strip() + "\n"
    for r in rows:
        existing = r.get("persona") or ""
        if PERSONA_HEADER in existing:
            existing = existing.split(PERSONA_HEADER)[0].rstrip()
        r["persona"] = existing + suffix

    with open(profiles_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    return len(rows)


def apply_mood_modifier(
    sim_dir: str | Path,
    mood_text: str,
    platforms: Iterable[str] = ("reddit", "twitter", "polymarket"),
) -> dict[str, int]:
    """Apply mood_text to all profile files present in sim_dir.

    Args:
        sim_dir: child sim's directory (must contain *_profiles.* files)
        mood_text: paragraph to append to each persona
        platforms: which platforms to modify; missing files are silently skipped

    Returns dict mapping platform → count of profiles modified.
    """
    sim_dir = Path(sim_dir)
    if not mood_text or not mood_text.strip():
        return {}
    out: dict[str, int] = {}

    if "reddit" in platforms:
        p = sim_dir / "reddit_profiles.json"
        if p.exists():
            out["reddit"] = apply_mood_modifier_reddit(p, mood_text)

    if "twitter" in platforms:
        p = sim_dir / "twitter_profiles.csv"
        if p.exists():
            out["twitter"] = apply_mood_modifier_twitter(p, mood_text)

    if "polymarket" in platforms:
        p = sim_dir / "polymarket_profiles.json"
        if p.exists():
            # polymarket_profiles.json uses the same shape as reddit
            out["polymarket"] = apply_mood_modifier_reddit(p, mood_text)

    return out


# ---------------------------------------------------------------------------
# CLI for ad-hoc use
# ---------------------------------------------------------------------------

def _main():
    import argparse
    p = argparse.ArgumentParser(
        description="Append a private-inner-state paragraph to a sim's agent profiles.",
    )
    p.add_argument("sim_dir", help="Path to the child sim's directory")
    p.add_argument("mood_text", help="Mood paragraph to append (or '-' to read from stdin)")
    p.add_argument("--platforms", nargs="+", default=("reddit", "twitter", "polymarket"))
    args = p.parse_args()

    if args.mood_text == "-":
        import sys
        mood = sys.stdin.read()
    else:
        mood = args.mood_text

    counts = apply_mood_modifier(args.sim_dir, mood, args.platforms)
    print(f"applied mood to: {counts}")


if __name__ == "__main__":
    _main()
