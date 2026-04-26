"""Aggregator + viewer (Phase 4).

Reads the manifest JSON produced by the orchestrator (Phase 3) and produces:

  - aggregated.json   — per-variable probabilities, CIs, distributions,
                        cluster summaries
  - branches.csv      — flat per-branch table
  - dashboard.html    — single-page readable view

Math notes:

  - Booleans: probability with Wilson 95% confidence interval. Wilson is
    the right choice at small N because Normal-approximation breaks
    when the proportion is near 0 or 1 — common with N=8.
  - Numerics: count, mean, median, p10/p90, min/max.
  - Categorical / strings: frequency table.
  - Null handling: a branch's null on a variable means "no data" for that
    variable. Excluded from the variable's denominator. Counted only in
    a "n_null" field for transparency.
  - Invalid branches: excluded entirely from every aggregation.

Cluster summaries: branches are grouped by ``aggregation.primary_split``
(declared in the scenario YAML). For each cluster we make one LLM call
that generates a 1-paragraph narrative summary describing what those
branches had in common.
"""

from __future__ import annotations

import csv
import json
import math
import os
import statistics
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from openai import OpenAI

# Inline SVG charting (no external deps)
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).parent.parent))
from worldfork.charting import (  # noqa: E402
    prob_bars_svg,
    heatmap_svg,
    histogram_svg,
    comparison_bars_svg,
)


# ---------------------------------------------------------------------------
# Stats helpers
# ---------------------------------------------------------------------------

def wilson_interval(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson 95%-confidence interval for a binomial proportion.

    k successes out of n trials. Returns (lower, upper).
    Falls back gracefully when n=0 (returns (0.0, 1.0)).
    """
    if n == 0:
        return (0.0, 1.0)
    p_hat = k / n
    z2 = z * z
    denom = 1 + z2 / n
    centre = p_hat + z2 / (2 * n)
    half = z * math.sqrt(p_hat * (1 - p_hat) / n + z2 / (4 * n * n))
    return (max(0.0, (centre - half) / denom), min(1.0, (centre + half) / denom))


def percentile(values: list[float], p: float) -> float:
    """Linear-interpolated percentile (p in [0, 100])."""
    if not values:
        return float("nan")
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    rank = (p / 100) * (len(s) - 1)
    lo = math.floor(rank)
    hi = math.ceil(rank)
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (rank - lo)


# ---------------------------------------------------------------------------
# Per-variable aggregation
# ---------------------------------------------------------------------------

@dataclass
class VarStats:
    name: str
    type: str
    n_total: int       # valid branches with this variable populated (any non-null)
    n_null: int        # valid branches where this variable is null
    n_excluded: int    # invalid branches (counted globally, not per-var)
    summary: dict[str, Any]


def _aggregate_bool(name: str, values: list[Any]) -> VarStats:
    non_null = [v for v in values if v is not None]
    n = len(non_null)
    n_null = len(values) - n
    k = sum(1 for v in non_null if v is True)
    p = k / n if n else None
    lo, hi = wilson_interval(k, n) if n else (None, None)
    return VarStats(
        name=name, type="bool",
        n_total=n, n_null=n_null, n_excluded=0,
        summary={
            "n_true": k,
            "n_false": n - k,
            "probability": p,
            "ci_low": lo,
            "ci_high": hi,
            "ci_width": (hi - lo) if (lo is not None and hi is not None) else None,
        },
    )


def _aggregate_numeric(name: str, values: list[Any]) -> VarStats:
    non_null = [float(v) for v in values if v is not None]
    n = len(non_null)
    n_null = len(values) - n
    if n == 0:
        return VarStats(name=name, type="numeric", n_total=0, n_null=n_null, n_excluded=0,
                        summary={})
    return VarStats(
        name=name, type="numeric",
        n_total=n, n_null=n_null, n_excluded=0,
        summary={
            "mean": statistics.fmean(non_null),
            "median": statistics.median(non_null),
            "stdev": statistics.stdev(non_null) if n > 1 else 0.0,
            "p10": percentile(non_null, 10),
            "p90": percentile(non_null, 90),
            "min": min(non_null),
            "max": max(non_null),
        },
    )


def _aggregate_categorical(name: str, values: list[Any]) -> VarStats:
    non_null = [v for v in values if v is not None]
    n = len(non_null)
    n_null = len(values) - n
    counts: dict[str, int] = {}
    for v in non_null:
        key = str(v)
        counts[key] = counts.get(key, 0) + 1
    return VarStats(
        name=name, type="categorical",
        n_total=n, n_null=n_null, n_excluded=0,
        summary={"counts": dict(sorted(counts.items(), key=lambda kv: -kv[1]))},
    )


def aggregate_variables(manifest: dict, schema_outcomes: list[dict]) -> dict[str, VarStats]:
    """Compute per-variable stats across all valid branches in the manifest."""
    valid = [b for b in manifest["branches"] if b.get("valid") and b.get("outcomes")]
    n_excluded = len(manifest["branches"]) - len(valid)

    out: dict[str, VarStats] = {}
    for spec in schema_outcomes:
        name = spec["name"]
        vtype = spec["type"]
        values = [b["outcomes"].get(name) for b in valid]

        if vtype == "bool":
            stats = _aggregate_bool(name, values)
        elif vtype in ("int", "float", "numeric"):
            stats = _aggregate_numeric(name, values)
        else:
            stats = _aggregate_categorical(name, values)
        stats.n_excluded = n_excluded
        out[name] = stats
    return out


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def cluster_by(manifest: dict, primary_split: str) -> dict[str, list[dict]]:
    """Group valid branches by the value of `primary_split`.

    None values get bucketed under the key "(no data)".
    Returns dict mapping str(value) -> list of branches.
    """
    valid = [b for b in manifest["branches"] if b.get("valid") and b.get("outcomes")]
    clusters: dict[str, list[dict]] = {}
    for b in valid:
        val = b["outcomes"].get(primary_split)
        key = "(no data)" if val is None else str(val)
        clusters.setdefault(key, []).append(b)
    return clusters


def _summarize_one_cluster(
    client: OpenAI,
    model: str,
    primary_split: str,
    cluster_key: str,
    branches: list[dict],
    scenario_name: str,
) -> str:
    """Generate a 1-paragraph narrative summary for one cluster."""
    lines = []
    for b in branches:
        lines.append(
            f"- Branch '{b['label']}': perturbation = {b['perturbation_text'][:200]}"
        )
        if b.get("classifier_reasoning"):
            lines.append(f"  → {b['classifier_reasoning'][:300]}")
    cluster_payload = "\n".join(lines)

    prompt = f"""Below are {len(branches)} simulated branches that all ended with
{primary_split}={cluster_key} in scenario "{scenario_name}".

For each branch, you have its perturbation (the news event injected at the
fork round) and the classifier's brief reasoning about how the simulation played out.

Write a single tight paragraph (3–5 sentences) summarizing what these branches
had in common: the catalyst pattern, the dynamics that produced this outcome,
and any notable variation across them. Do NOT speculate beyond the evidence.

BRANCHES:
{cluster_payload}

Output ONLY the paragraph (no preamble, no list, no markdown)."""

    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return resp.choices[0].message.content.strip()


def summarize_clusters(
    clusters: dict[str, list[dict]],
    primary_split: str,
    scenario_name: str,
    model: str | None = None,
    skip_llm: bool = False,
) -> dict[str, str]:
    """Generate narrative summaries for each cluster (one LLM call per cluster)."""
    if skip_llm:
        return {k: f"({len(v)} branches; LLM summary skipped)"
                for k, v in clusters.items()}

    api_key = (os.environ.get("SMART_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    base_url = (os.environ.get("SMART_BASE_URL") or os.environ.get("OPENAI_API_BASE_URL"))
    chosen_model = (model or os.environ.get("SMART_MODEL_NAME")
                    or "google/gemini-3.1-flash-lite-preview")
    client = OpenAI(api_key=api_key, base_url=base_url)

    out: dict[str, str] = {}
    for key, branches in clusters.items():
        try:
            out[key] = _summarize_one_cluster(
                client, chosen_model, primary_split, key, branches, scenario_name
            )
        except Exception as e:
            out[key] = f"(summary failed: {e})"
    return out


# ---------------------------------------------------------------------------
# Output writers
# ---------------------------------------------------------------------------

def write_csv(manifest: dict, schema_outcomes: list[dict], out_path: Path) -> None:
    """Per-branch flat table."""
    var_names = [s["name"] for s in schema_outcomes]
    fields = (
        ["label", "child_sim_id", "valid", "invalid_reason",
         "runner_status", "final_round", "total_rounds", "posts_count"]
        + var_names
        + ["perturbation_text"]
    )
    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for b in manifest["branches"]:
            row: dict[str, Any] = {
                "label": b.get("label"),
                "child_sim_id": b.get("child_sim_id"),
                "valid": b.get("valid"),
                "invalid_reason": b.get("invalid_reason") or "",
                "runner_status": b.get("runner_status"),
                "final_round": b.get("final_round"),
                "total_rounds": b.get("total_rounds"),
                "posts_count": b.get("posts_count"),
                "perturbation_text": (b.get("perturbation_text") or "")[:300],
            }
            outcomes = b.get("outcomes") or {}
            for v in var_names:
                row[v] = outcomes.get(v)
            w.writerow(row)


def _fmt_pct(p: float | None, n: int) -> str:
    if p is None:
        return "—"
    return f"{p*100:.1f}% (n={n})"


def _fmt_ci(lo: float | None, hi: float | None) -> str:
    if lo is None or hi is None:
        return "—"
    return f"[{lo*100:.1f}%, {hi*100:.1f}%]"


def write_html(
    manifest: dict,
    schema_outcomes: list[dict],
    var_stats: dict[str, VarStats],
    cluster_summaries: dict[str, str],
    primary_split: str,
    out_path: Path,
) -> None:
    """One-page self-contained HTML dashboard."""
    n_total = len(manifest["branches"])
    n_valid = sum(1 for b in manifest["branches"] if b.get("valid"))

    # ===== Charts =====
    # Probability bar chart for binary variables
    bool_items = []
    for spec in schema_outcomes:
        if spec["type"] != "bool":
            continue
        vs = var_stats[spec["name"]]
        bool_items.append({
            "name": spec["name"],
            "n_total": vs.n_total,
            "probability": vs.summary.get("probability"),
            "ci_low": vs.summary.get("ci_low"),
            "ci_high": vs.summary.get("ci_high"),
        })
    prob_chart = prob_bars_svg(bool_items, title="Probability by binary outcome (Wilson 95% CI)") if bool_items else ""

    # Heatmap of per-branch outcomes
    heat_chart = heatmap_svg(
        manifest["branches"], schema_outcomes,
        title="Per-branch outcome heatmap (rows = branches, cols = variables)",
    )

    # Histograms for numeric variables
    valid_branches = [b for b in manifest["branches"] if b.get("valid") and b.get("outcomes")]
    hist_charts = []
    for spec in schema_outcomes:
        if spec["type"] not in ("int", "float", "numeric"):
            continue
        vals = [b["outcomes"].get(spec["name"]) for b in valid_branches]
        rng = tuple(spec["range"]) if spec.get("range") else None
        hist_charts.append(histogram_svg(spec["name"], vals, range_hint=rng))

    # Build variable section
    var_html = []
    for spec in schema_outcomes:
        name = spec["name"]
        vs = var_stats[name]
        var_html.append(f'<section class="var"><h3>{name} <small>({vs.type})</small></h3>')
        var_html.append(f'<p class="desc">{spec["description"]}</p>')
        if vs.type == "bool":
            s = vs.summary
            var_html.append(
                f'<table><tr>'
                f'<th>P(true)</th><td><strong>{_fmt_pct(s.get("probability"), vs.n_total)}</strong></td>'
                f'<th>95% CI</th><td>{_fmt_ci(s.get("ci_low"), s.get("ci_high"))}</td>'
                f'<th>n null</th><td>{vs.n_null}</td>'
                f'</tr></table>'
            )
        elif vs.type == "numeric":
            s = vs.summary
            if not s:
                var_html.append('<p class="empty">no data across branches</p>')
            else:
                var_html.append(
                    f'<table>'
                    f'<tr><th>n</th><td>{vs.n_total}</td>'
                    f'<th>n null</th><td>{vs.n_null}</td>'
                    f'<th>mean</th><td>{s["mean"]:.2f}</td>'
                    f'<th>median</th><td>{s["median"]:.2f}</td></tr>'
                    f'<tr><th>p10</th><td>{s["p10"]:.2f}</td>'
                    f'<th>p90</th><td>{s["p90"]:.2f}</td>'
                    f'<th>min</th><td>{s["min"]:.2f}</td>'
                    f'<th>max</th><td>{s["max"]:.2f}</td></tr>'
                    f'</table>'
                )
        else:
            counts = vs.summary.get("counts", {})
            rows = "".join(
                f'<tr><td>{k}</td><td>{v}</td></tr>'
                for k, v in counts.items()
            )
            var_html.append(f'<table><tr><th>value</th><th>count</th></tr>{rows}</table>')
        var_html.append('</section>')

    # Cluster section
    cluster_html = []
    for key, summary in cluster_summaries.items():
        cluster_html.append(
            f'<section class="cluster"><h3>{primary_split} = {key}</h3>'
            f'<p>{summary}</p></section>'
        )

    # Per-branch table
    branch_rows = []
    var_names = [s["name"] for s in schema_outcomes]
    th = "".join(f"<th>{v}</th>" for v in var_names)
    branch_rows.append(
        f"<tr><th>label</th><th>valid</th>{th}<th>perturbation</th></tr>"
    )
    for b in manifest["branches"]:
        outcomes = b.get("outcomes") or {}
        valid_chip = ('<span class="ok">✓</span>' if b.get("valid")
                      else f'<span class="bad" title="{b.get("invalid_reason","")}">✗</span>')
        cells = []
        for v in var_names:
            val = outcomes.get(v)
            cells.append(f"<td>{'—' if val is None else val}</td>")
        pert = (b.get("perturbation_text") or "")[:120].replace('"', '&quot;')
        branch_rows.append(
            f"<tr><td>{b.get('label','?')}</td><td>{valid_chip}</td>"
            f"{''.join(cells)}<td><span title=\"{pert}\">{pert[:80]}…</span></td></tr>"
        )

    css = """
    body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
           max-width: 1100px; margin: 2em auto; padding: 0 1.5em; line-height: 1.5; color: #222; }
    h1 { margin-bottom: 0; }
    h1 + .meta { color: #666; margin-top: 0.4em; }
    h2 { border-bottom: 1px solid #ddd; padding-bottom: 0.3em; margin-top: 2em; }
    section.var { margin: 1.2em 0; padding: 0.6em 1em; background: #f7f8fa; border-radius: 6px; }
    section.var h3 { margin: 0.2em 0; }
    section.var .desc { color: #555; margin: 0.3em 0 0.7em 0; font-size: 0.95em; }
    section.cluster { margin: 1em 0; padding: 0.8em 1.1em; background: #fff8eb;
                       border-left: 3px solid #d8a73a; border-radius: 4px; }
    section.cluster h3 { margin: 0 0 0.4em 0; }
    table { border-collapse: collapse; margin: 0.4em 0; }
    table.branches { width: 100%; }
    th, td { padding: 0.35em 0.7em; text-align: left; }
    th { color: #666; font-weight: 500; font-size: 0.95em; }
    .empty { color: #999; font-style: italic; }
    .ok { color: #0a7e2c; font-weight: 700; }
    .bad { color: #b00020; font-weight: 700; cursor: help; }
    small { color: #888; font-weight: 400; }
    .charts { margin: 1.5em 0; padding: 1em; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow-x: auto; }
    .charts h3 { margin: 0 0 0.6em 0; font-size: 1em; color: #374151; }
    .charts.hist-row { display: flex; flex-wrap: wrap; gap: 0.8em; }
    .charts.hist-row svg { flex: 0 0 auto; }
    """

    summary_html = (
        f'<dl class="meta-list">'
        f'<dt>Scenario:</dt><dd>{manifest.get("scenario_name", "?")}</dd>'
        f'<dt>Parent sim:</dt><dd>{manifest.get("parent_sim_id", "?")}</dd>'
        f'<dt>Fork round:</dt><dd>{manifest.get("fork_round", "?")}</dd>'
        f'<dt>Branches:</dt><dd>{n_valid} valid / {n_total} total</dd>'
        f'<dt>Duration:</dt><dd>{manifest.get("duration_sec", 0):.0f}s</dd>'
        f'</dl>'
    )

    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>WorldFork — {manifest.get('scenario_name','run')}</title>
  <style>{css}</style>
</head>
<body>
  <h1>WorldFork run: {manifest.get('scenario_name','?')}</h1>
  <p class="meta">{manifest.get('finished_at','')}</p>
  {summary_html}

  <h2>Outcome distributions</h2>

  <div class="charts">
    {prob_chart}
  </div>

  <div class="charts">
    <h3>Per-branch outcome map</h3>
    {heat_chart}
  </div>

  <div class="charts hist-row">
    {''.join(hist_charts)}
  </div>

  <h3>Variable details</h3>
  {''.join(var_html)}

  <h2>Cluster summaries (split by {primary_split})</h2>
  {''.join(cluster_html) or '<p class="empty">No clusters formed (insufficient valid branches).</p>'}

  <h2>Per-branch detail</h2>
  <table class="branches">{''.join(branch_rows)}</table>
</body>
</html>
"""
    out_path.write_text(html)


# ---------------------------------------------------------------------------
# Top-level
# ---------------------------------------------------------------------------

def aggregate_run(
    manifest_path: str | Path,
    scenario_path: str | Path,
    out_dir: str | Path | None = None,
    skip_llm_summary: bool = False,
) -> dict:
    """Read a manifest + scenario, produce all outputs, return the aggregated dict."""
    manifest_path = Path(manifest_path)
    scenario_path = Path(scenario_path)

    manifest = json.loads(manifest_path.read_text())
    with open(scenario_path) as f:
        scenario = yaml.safe_load(f)

    schema_outcomes = scenario["outcomes"]
    primary_split = (scenario.get("aggregation") or {}).get(
        "primary_split", schema_outcomes[0]["name"]
    )
    cluster_summarize_enabled = (
        (scenario.get("aggregation") or {}).get("cluster_summarize", True)
    )

    var_stats = aggregate_variables(manifest, schema_outcomes)
    clusters = cluster_by(manifest, primary_split)
    cluster_summaries = summarize_clusters(
        clusters,
        primary_split=primary_split,
        scenario_name=manifest.get("scenario_name", "?"),
        skip_llm=skip_llm_summary or not cluster_summarize_enabled,
    )

    # Output dir
    if out_dir is None:
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        out_dir = manifest_path.parent / f"aggregated_{manifest_path.stem}_{ts}"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Write artifacts
    aggregated = {
        "scenario_name": manifest.get("scenario_name"),
        "parent_sim_id": manifest.get("parent_sim_id"),
        "fork_round": manifest.get("fork_round"),
        "n_total_branches": len(manifest["branches"]),
        "n_valid_branches": sum(1 for b in manifest["branches"] if b.get("valid")),
        "primary_split": primary_split,
        "variables": {
            name: {
                "type": vs.type,
                "n_total": vs.n_total,
                "n_null": vs.n_null,
                **vs.summary,
            }
            for name, vs in var_stats.items()
        },
        "clusters": {
            key: {
                "n_branches": len(branches),
                "branch_labels": [b["label"] for b in branches],
                "summary": cluster_summaries.get(key, ""),
            }
            for key, branches in clusters.items()
        },
    }

    (out_dir / "aggregated.json").write_text(json.dumps(aggregated, indent=2))
    write_csv(manifest, schema_outcomes, out_dir / "branches.csv")
    write_html(manifest, schema_outcomes, var_stats,
               cluster_summaries, primary_split, out_dir / "dashboard.html")

    print(f"[aggregator] wrote artifacts → {out_dir}/")
    print(f"  aggregated.json")
    print(f"  branches.csv")
    print(f"  dashboard.html")
    return aggregated


# ---------------------------------------------------------------------------
# Cross-run comparison
# ---------------------------------------------------------------------------

def compare_runs(
    manifest_paths: list[str | Path],
    scenario_path: str | Path,
    out_path: str | Path | None = None,
    skip_llm_summary: bool = True,
) -> dict:
    """Compare two (or more) ensemble runs of the same scenario.

    For each binary outcome variable, checks whether run-2's probability
    falls inside run-1's Wilson 95% CI. That's the formal Phase-5 stability
    test — if all (or most) binary variables pass, the system is producing
    reproducible probabilistic signal.
    """
    if len(manifest_paths) < 2:
        raise ValueError("compare_runs needs at least 2 manifest paths")

    with open(scenario_path) as f:
        scenario = yaml.safe_load(f)
    schema_outcomes = scenario["outcomes"]

    # Aggregate each manifest
    runs = []
    for mp in manifest_paths:
        manifest = json.loads(Path(mp).read_text())
        var_stats = aggregate_variables(manifest, schema_outcomes)
        runs.append({"manifest": manifest, "var_stats": var_stats})

    # Build comparison rows for binary variables
    pairs = []
    for spec in schema_outcomes:
        if spec["type"] != "bool":
            continue
        name = spec["name"]
        row = {"name": name}
        for i, run in enumerate(runs[:2]):
            vs = run["var_stats"][name]
            row[f"run{i+1}"] = {
                "p": vs.summary.get("probability"),
                "lo": vs.summary.get("ci_low"),
                "hi": vs.summary.get("ci_high"),
                "n": vs.n_total,
            }
        pairs.append(row)

    # Stability check: how many run-2 probs fall inside run-1's CI?
    stable = 0
    total = 0
    details = []
    for row in pairs:
        r1 = row.get("run1") or {}
        r2 = row.get("run2") or {}
        p1, lo1, hi1 = r1.get("p"), r1.get("lo"), r1.get("hi")
        p2 = r2.get("p")
        if all(v is not None for v in (p1, lo1, hi1, p2)):
            within = lo1 <= p2 <= hi1
            stable += int(within)
            total += 1
            details.append({"name": row["name"], "p1": p1, "p2": p2,
                            "ci_low": lo1, "ci_high": hi1, "within_ci": within})

    # Build comparison HTML
    chart_svg = comparison_bars_svg(pairs, title=f"Run-1 vs Run-2 stability check (N={runs[0]['manifest'].get('branches') and len(runs[0]['manifest']['branches'])} per run)")

    summary = {
        "scenario_name": scenario.get("name"),
        "n_runs": len(runs),
        "n_variables_compared": total,
        "n_stable": stable,
        "stability_rate": (stable / total) if total else None,
        "details": details,
        "manifest_paths": [str(p) for p in manifest_paths],
    }

    if out_path is None:
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        out_dir = Path(manifest_paths[0]).parent / f"comparison_{ts}"
    else:
        out_dir = Path(out_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "comparison.json").write_text(json.dumps(summary, indent=2))

    # Standalone HTML for the comparison
    css = """body{font-family:-apple-system,system-ui,sans-serif;max-width:1100px;margin:2em auto;padding:0 1.5em;line-height:1.5;color:#222}
h1{margin-bottom:0}h2{border-bottom:1px solid #ddd;padding-bottom:0.3em;margin-top:2em}
.summary{margin:1em 0;padding:1em;background:#f7f8fa;border-radius:6px;font-size:1.05em}
.summary strong{color:#1f2937}
table{border-collapse:collapse;width:100%;margin:0.4em 0}
th,td{padding:0.4em 0.7em;text-align:left;border-bottom:1px solid #eee}
th{color:#666;font-weight:500;font-size:0.95em}
.ok{color:#16a34a;font-weight:700}.bad{color:#dc2626;font-weight:700}
.charts{margin:1.5em 0;padding:1em;background:#fff;border:1px solid #e5e7eb;border-radius:6px}"""
    rows = []
    for d in details:
        cls = "ok" if d["within_ci"] else "bad"
        chip = "✓ within CI" if d["within_ci"] else "✗ outside CI"
        rows.append(
            f'<tr><td>{d["name"]}</td>'
            f'<td>{d["p1"]*100:.1f}%</td>'
            f'<td>[{d["ci_low"]*100:.1f}%, {d["ci_high"]*100:.1f}%]</td>'
            f'<td>{d["p2"]*100:.1f}%</td>'
            f'<td class="{cls}">{chip}</td></tr>'
        )
    table_html = (
        '<table><thead><tr>'
        '<th>variable</th><th>run-1 P</th><th>run-1 95% CI</th><th>run-2 P</th><th>stability</th>'
        '</tr></thead><tbody>' + "".join(rows) + '</tbody></table>'
    )
    summary_html = (
        f'<div class="summary"><strong>{stable}/{total}</strong> binary variables had run-2 within run-1\'s 95% CI '
        f'<small>(higher = more reproducible)</small></div>'
    )
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>WorldFork comparison</title>
<style>{css}</style></head><body>
<h1>Cross-run stability check</h1>
<p style="color:#666">{scenario.get("name")} — {datetime.utcnow().isoformat()}Z</p>
{summary_html}
<div class="charts">{chart_svg}</div>
<h2>Per-variable detail</h2>
{table_html}
</body></html>"""
    (out_dir / "comparison.html").write_text(html)

    print(f"[compare_runs] {stable}/{total} variables stable")
    print(f"[compare_runs] wrote artifacts → {out_dir}/")
    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main():
    import argparse
    p = argparse.ArgumentParser(description="WorldFork aggregator (Phase 4)")
    p.add_argument("manifest", help="Path to the orchestrator's manifest JSON")
    p.add_argument("scenario", help="Path to the scenario YAML used for the run")
    p.add_argument("--out-dir", default=None,
                   help="Output directory (default: sibling of manifest)")
    p.add_argument("--skip-llm-summary", action="store_true",
                   help="Skip LLM cluster narrative summaries (faster, free)")
    args = p.parse_args()

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

    aggregate_run(
        manifest_path=args.manifest,
        scenario_path=args.scenario,
        out_dir=args.out_dir,
        skip_llm_summary=args.skip_llm_summary,
    )


if __name__ == "__main__":
    _main()
