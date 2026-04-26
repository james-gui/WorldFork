"""Layer-2 test: hand-crafted post corpora with known-correct outcomes.

Each case below has a synthetic post list and the expected classifier
output. We bypass sqlite and feed posts directly into the same prompt
the classifier uses, then assert the structured outputs match.

The schema mirrors what we'd use for a USDC depeg scenario, so this
also stress-tests our production schema design before we ever spin
up real sims.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make the worldfork package importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from worldfork.classifier import (  # noqa: E402
    _build_prompt,
    _make_client,
    _parse_json_response,
    render_corpus,
)


# Schema (kept inline for the test — mirrors usdc_depeg_scenario.yaml's outcomes)
OUTCOMES = [
    {
        "name": "broke_peg",
        "type": "bool",
        "description": (
            "Did any post explicitly state or reference USDC trading below "
            "$0.99 during the simulation? Speculation about a possible depeg "
            "without a concrete sub-$0.99 price reference does not count."
        ),
    },
    {
        "name": "peak_deviation_bps",
        "type": "int",
        "range": [0, 10000],
        "description": (
            "Maximum off-peg deviation from $1.00 mentioned in any post, "
            "in basis points. $0.997 = 30 bps. $0.95 = 500 bps. If no "
            "specific price below $1.00 is mentioned, return 0."
        ),
    },
    {
        "name": "blackrock_engaged",
        "type": "bool",
        "description": (
            "Did any post mention BlackRock, Circle Reserve Fund, or Larry "
            "Fink in the context of the cascade?"
        ),
    },
    {
        "name": "tether_substitution",
        "type": "bool",
        "description": (
            "Did any post explicitly suggest moving funds from USDC to USDT "
            "(Tether) as a response to the cascade?"
        ),
    },
]


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def _post(pid: int, uid: int, content: str, likes: int = 0, dislikes: int = 0) -> dict:
    return {
        "post_id": pid, "user_id": uid, "content": content,
        "created_at": "2026-04-25 09:30:00", "likes": likes, "dislikes": dislikes,
    }


CASES: list[dict] = [
    {
        "name": "clear_yes_explicit_price",
        "posts": [
            _post(1, 0, "USDC just hit $0.97 on Coinbase. This is bad.", 12, 0),
            _post(2, 1, "Down to 97 cents. I'm out.", 5, 1),
            _post(3, 2, "Looking like another SVB-style depeg. $0.978 last I checked.", 8, 0),
        ],
        "expected": {
            "broke_peg": True,
            "peak_deviation_bps": 300,  # $0.97 = 300 bps
            "blackrock_engaged": False,
            "tether_substitution": False,
        },
        # peak_deviation tolerance: ±100 bps (acceptable variance in LLM extraction)
        "numeric_tolerance": {"peak_deviation_bps": 100},
    },
    {
        "name": "clear_no_unrelated_topic",
        "posts": [
            _post(1, 0, "Bitcoin breaking $100k! Massive rally.", 50, 0),
            _post(2, 1, "ETH/BTC ratio looking bullish for ETH.", 20, 0),
            _post(3, 2, "Memecoin season is back, baby.", 30, 1),
        ],
        # Topic not discussed → classifier should return null, not False.
        # Aggregator excludes null branches from probability calc.
        "expected": {
            "broke_peg": None,
            "peak_deviation_bps": 0,
            "blackrock_engaged": None,
            "tether_substitution": None,
        },
    },
    {
        "name": "ambiguous_speculation_no_price",
        "posts": [
            _post(1, 0, "Depeg fears are growing. Watch USDC closely.", 8, 0),
            _post(2, 1, "If Circle loses another bank, the peg might break. Big if.", 15, 0),
            _post(3, 2, "Stay safe out there, this could go bad.", 5, 0),
        ],
        # Schema explicitly says "speculation without concrete sub-$0.99 reference does not count"
        "expected": {
            "broke_peg": False,
            "peak_deviation_bps": 0,
            "blackrock_engaged": False,
            "tether_substitution": False,
        },
    },
    {
        "name": "blackrock_engagement",
        "posts": [
            _post(1, 0, "Larry Fink just tweeted that BlackRock's Circle Reserve Fund is fully operational. Calming statement.", 80, 0),
            _post(2, 1, "BlackRock backing USDC reserves should put the fears to rest.", 40, 0),
            _post(3, 2, "USDC currently at $0.998. Holding peg for now.", 10, 0),
        ],
        "expected": {
            "broke_peg": False,  # 0.998 = 20 bps, not below $0.99
            "peak_deviation_bps": 20,
            "blackrock_engaged": True,
            "tether_substitution": None,  # not discussed → null
        },
        "numeric_tolerance": {"peak_deviation_bps": 30},
    },
    {
        "name": "tether_substitution_suggested",
        "posts": [
            _post(1, 0, "Just swapped my USDC bag to USDT. Not taking chances.", 25, 5),
            _post(2, 1, "Moving everything to Tether until this resolves.", 18, 8),
            _post(3, 2, "If you're worried, USDT is the obvious safe haven right now.", 30, 12),
        ],
        "expected": {
            "broke_peg": False,
            "peak_deviation_bps": 0,
            "blackrock_engaged": False,
            "tether_substitution": True,
        },
    },
    {
        "name": "edge_case_exactly_0_99",
        "posts": [
            _post(1, 0, "USDC at exactly $0.99. Peg holding by a thread.", 10, 0),
            _post(2, 1, "Not below 99 cents yet, stay calm.", 8, 0),
        ],
        # $0.99 is the threshold — not BELOW $0.99, so broke_peg should be false
        "expected": {
            "broke_peg": False,
            "peak_deviation_bps": 100,  # $0.99 = 100 bps
            "blackrock_engaged": None,    # not discussed → null
            "tether_substitution": None,  # not discussed → null
        },
        "numeric_tolerance": {"peak_deviation_bps": 30},
    },
    {
        "name": "deep_depeg",
        "posts": [
            _post(1, 0, "USDC absolutely tanking. $0.92 on Binance. $0.91 on Coinbase.", 200, 5),
            _post(2, 1, "Down to 88 cents. Total panic.", 80, 10),
            _post(3, 2, "BlackRock's Circle Reserve Fund hasn't responded. Where is Fink?", 50, 0),
            _post(4, 3, "Moving everything to USDT immediately. USDC is cooked.", 60, 5),
        ],
        "expected": {
            "broke_peg": True,
            "peak_deviation_bps": 1200,  # $0.88 = 1200 bps
            "blackrock_engaged": True,
            "tether_substitution": True,
        },
        "numeric_tolerance": {"peak_deviation_bps": 200},
    },
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_case(case: dict, model: str, temperature: float = 0.0) -> dict:
    """Run one test case through the classifier prompt and return its parsed output."""
    posts = case["posts"]
    corpus = render_corpus(posts, comments=[])
    prompt = _build_prompt(corpus, OUTCOMES)

    client = _make_client()
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return _parse_json_response(resp.choices[0].message.content)


def compare(actual: dict, expected: dict, tolerance: dict | None = None) -> tuple[bool, list[str]]:
    """Return (pass, list of mismatches).

    Boolean expectation semantics:
      - expected=True  → must be True (must catch positive evidence)
      - expected=False → False or None acceptable (evidence-based-false OR absence; both safe)
      - expected=None  → None or False acceptable (absence of evidence; both produce the same
                         conservative downstream behavior)

    The unacceptable failures are: returning True when expected None/False (hallucination),
    or returning False/None when expected True (missed positive evidence).
    """
    tolerance = tolerance or {}
    mismatches = []
    for k, exp in expected.items():
        act = actual.get(k)
        if isinstance(exp, bool):
            if exp is True:
                # Must catch positive evidence
                if act is not True:
                    mismatches.append(f"  {k}: expected True (positive evidence), got {act}")
            else:  # exp is False
                # False or None both acceptable (both are 'not engaged')
                if act is True:
                    mismatches.append(f"  {k}: expected False/None, got True (hallucination?)")
        elif exp is None:
            # Absence: None or False acceptable; True would be hallucination
            if act is True:
                mismatches.append(f"  {k}: expected None/False (absent topic), got True (hallucination?)")
        elif isinstance(exp, (int, float)):
            tol = tolerance.get(k, 0)
            # When expected is 0, accept None (both indicate "no deviation" for downstream agg).
            if exp == 0 and act is None:
                pass
            elif act is None or abs(act - exp) > tol:
                mismatches.append(f"  {k}: expected {exp} (±{tol}), got {act}")
        else:
            if act != exp:
                mismatches.append(f"  {k}: expected {exp}, got {act}")
    return len(mismatches) == 0, mismatches


def main():
    # Load env
    try:
        from dotenv import load_dotenv
        for env_path in [
            Path(__file__).parent.parent / ".env",
            Path("/Users/james/Documents/WorldFork/short/MiroShark/.env"),
        ]:
            if env_path.exists():
                load_dotenv(env_path)
                break
    except ImportError:
        pass

    model = (os.environ.get("SMART_MODEL_NAME")
             or "google/gemini-3.1-flash-lite-preview")

    passed = 0
    failed = 0
    for case in CASES:
        try:
            result = run_case(case, model)
            outcomes = result.get("outcomes", {})
            ok, mismatches = compare(outcomes, case["expected"], case.get("numeric_tolerance"))
            status = "PASS" if ok else "FAIL"
            print(f"\n[{status}] {case['name']}")
            print(f"  outcomes: {json.dumps(outcomes)}")
            if not ok:
                print("  mismatches:")
                for m in mismatches:
                    print(m)
                print(f"  reasoning: {result.get('reasoning', '')[:200]}")
                failed += 1
            else:
                passed += 1
        except Exception as e:
            print(f"\n[ERROR] {case['name']}: {e}")
            failed += 1

    print(f"\n{'=' * 50}")
    print(f"Layer 2: {passed}/{len(CASES)} passed, {failed} failed")
    print(f"{'=' * 50}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
