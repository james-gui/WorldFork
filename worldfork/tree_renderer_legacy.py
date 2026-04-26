"""Branch-tree SVG renderer for WorldFork ensembles.

Layout:
  - Y axis: simulation rounds (0 → horizon_rounds), top to bottom
  - X axis: branches, evenly spread under their parent
  - Root node at top
  - Branches fan out at fork_round
  - Each branch is a vertical line painted with a 'sentiment heat strip'
    (color = panic_score, segment intensity = activity_per_round)
  - Leaf node at bottom = terminal state with outcome chip

Architecture is recursive on (parent → children) so it scales naturally
from v0 (one fork at round 0) to v0.5 (multi-fork with deep trees) — but
v0 only ever uses the depth-1 case.

Output: a complete HTML string with embedded SVG and the JS+CSS needed for
hover tooltips + click-through-to-branch-detail.
"""

from __future__ import annotations

import html as html_lib
import json
import math
from typing import Any


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def _color_for_panic(panic: float | None) -> str:
    """Map panic_score (0=panicked, 10=calm) to a color.

    panic_score 0 → deep red
    panic_score 5 → neutral yellow-gray
    panic_score 10 → calm blue
    """
    if panic is None:
        return "#9ca3af"  # gray
    t = max(0.0, min(1.0, panic / 10.0))
    # 0..0.5 → red→yellow; 0.5..1 → yellow→blue
    if t < 0.5:
        a = (220, 38, 38)   # red
        b = (234, 179, 8)   # amber
        local = t * 2
    else:
        a = (234, 179, 8)   # amber
        b = (37, 99, 235)   # blue
        local = (t - 0.5) * 2
    rr = int(a[0] + (b[0] - a[0]) * local)
    rg = int(a[1] + (b[1] - a[1]) * local)
    rb = int(a[2] + (b[2] - a[2]) * local)
    return f"#{rr:02x}{rg:02x}{rb:02x}"


def _esc(s) -> str:
    return html_lib.escape(str(s))


# ---------------------------------------------------------------------------
# Tree layout (Reingold-Tilford simplified for our v0 use case)
# ---------------------------------------------------------------------------

def _layout_branches(
    n_branches: int,
    canvas_w: int,
    margin_left: int,
    margin_right: int,
) -> list[float]:
    """Return x-coordinates for n_branches evenly spread."""
    plot_w = canvas_w - margin_left - margin_right
    if n_branches == 1:
        return [margin_left + plot_w / 2]
    return [
        margin_left + plot_w * (i + 0.5) / n_branches
        for i in range(n_branches)
    ]


# ---------------------------------------------------------------------------
# Per-branch line rendering (with sentiment heat strip)
# ---------------------------------------------------------------------------

def _render_branch_line(
    branch: dict,
    timeline: dict[int, dict],
    x: float,
    y_top: float,
    y_bottom: float,
    horizon_rounds: int,
    panic_score: float | None,
    current_round: int | None = None,
    branch_status: str = "classified",
) -> str:
    """Render a single branch's vertical line, accounting for live state.

    branch_status values:
      - "pending"    : not yet created (e.g. perturbation generated but no fork yet)
      - "created"    : forked but runner not started
      - "started" / "running" : in flight; only fill up to current_round
      - "completed"  : sim done, awaiting classifier
      - "classified" : final outcomes available
      - "invalid"    : sim ran but didn't pass validity
    """
    h_per_round = (y_bottom - y_top) / horizon_rounds

    # Pending / not-yet-created: dashed grey placeholder
    if branch_status == "pending":
        return (
            f'<line x1="{x:.1f}" y1="{y_top:.1f}" x2="{x:.1f}" y2="{y_bottom:.1f}" '
            f'stroke="#cbd5e1" stroke-width="2" stroke-dasharray="3,5" opacity="0.6"/>'
        )

    # If we have a finished classifier color, use the panic gradient. Otherwise neutral.
    has_outcomes = branch_status == "classified" and panic_score is not None
    color = _color_for_panic(panic_score) if has_outcomes else "#6b7280"
    if branch_status == "invalid":
        color = "#9ca3af"

    # Determine how many rounds to fill based on status
    if branch_status in ("started", "created"):
        fill_rounds = max(1, (current_round or 0))
    elif branch_status in ("running",):
        fill_rounds = max(1, current_round or 0)
    else:
        # completed / classified / invalid — fill the whole horizon
        fill_rounds = horizon_rounds

    fill_rounds = min(fill_rounds, horizon_rounds)

    max_intensity = max((row.get("intensity", 0) for row in timeline.values()),
                         default=0) if timeline else 0

    parts = []
    # Filled portion (up to current_round)
    for r in range(fill_rounds):
        row = timeline.get(r, {}) if timeline else {}
        intensity = row.get("intensity", 0)
        if max_intensity > 0:
            w = 2 + 12 * (intensity / max_intensity)
        else:
            w = 3
        opacity = (0.4 + 0.6 * (intensity / max(max_intensity, 1))) if max_intensity > 0 else 0.85
        y0 = y_top + r * h_per_round
        y1 = y0 + h_per_round
        parts.append(
            f'<line x1="{x:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y1:.1f}" '
            f'stroke="{color}" stroke-width="{w:.1f}" stroke-linecap="butt" opacity="{opacity:.2f}"/>'
        )

    # Unfilled portion (rest of horizon, dashed)
    if fill_rounds < horizon_rounds:
        y0 = y_top + fill_rounds * h_per_round
        y1 = y_bottom
        parts.append(
            f'<line x1="{x:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y1:.1f}" '
            f'stroke="#d1d5db" stroke-width="2" stroke-dasharray="3,4" opacity="0.5"/>'
        )

    # If running, draw the leading-edge marker (small circle that pulses via JS)
    if branch_status in ("running", "started", "created") and fill_rounds > 0:
        y_edge = y_top + fill_rounds * h_per_round
        parts.append(
            f'<circle class="wf-running-marker" cx="{x:.1f}" cy="{y_edge:.1f}" r="4" '
            f'fill="{color}" stroke="white" stroke-width="1.5"/>'
        )

    return "".join(parts)


# ---------------------------------------------------------------------------
# Top-level tree SVG
# ---------------------------------------------------------------------------

def render_tree_svg(
    manifest: dict,
    timelines: dict[str, dict[int, dict]],
    schema_outcomes: list[dict],
    *,
    horizon_rounds: int = 20,
    fork_round: int = 0,
    width: int = 1080,
    expected_n_branches: int | None = None,
) -> str:
    """Render the full ensemble tree as an SVG string.

    Caller is responsible for embedding it in HTML and providing the JS that
    reads `data-*` attributes on each branch group for hover/click handlers.

    Branches are rendered according to their `status` field — supports both
    finished manifests (status=classified/invalid) and live in-flight state
    (status=created/started/running/completed). Pass expected_n_branches to
    pad the layout with placeholder branches before all forks have happened.
    """
    branches = list(manifest["branches"])
    actual_n = len(branches)
    n = max(actual_n, expected_n_branches or actual_n, 1)

    # Pad with pending placeholder branches if we know N but don't have them all yet
    while len(branches) < n:
        branches.append({"label": f"(pending {len(branches)+1})", "status": "pending"})

    margin_top = 70
    margin_bottom = 110
    margin_left = 60
    margin_right = 60
    plot_h_per_round = 22  # px
    height = margin_top + horizon_rounds * plot_h_per_round + margin_bottom

    xs = _layout_branches(n, width, margin_left, margin_right)
    root_x = (margin_left + (width - margin_right)) / 2
    root_y = margin_top

    fork_y = margin_top + fork_round * plot_h_per_round
    branch_top_y = fork_y
    branch_bottom_y = margin_top + horizon_rounds * plot_h_per_round

    parts: list[str] = []
    parts.append(
        f'<svg id="wf-tree" width="{width}" height="{height}" '
        f'font-family="-apple-system, system-ui, sans-serif" font-size="13">'
    )

    # ----- Round axis on the left -----
    for r in range(horizon_rounds + 1):
        y = margin_top + r * plot_h_per_round
        parts.append(
            f'<line x1="{margin_left - 8}" y1="{y:.1f}" x2="{margin_left - 4}" y2="{y:.1f}" '
            f'stroke="#9ca3af" stroke-width="1"/>'
        )
        if r % 5 == 0 or r == horizon_rounds:
            parts.append(
                f'<text x="{margin_left - 12}" y="{y + 4:.1f}" text-anchor="end" '
                f'fill="#6b7280" font-size="11">round {r}</text>'
            )
    # Vertical axis line
    parts.append(
        f'<line x1="{margin_left - 4}" y1="{margin_top}" x2="{margin_left - 4}" '
        f'y2="{branch_bottom_y:.1f}" stroke="#d1d5db" stroke-width="1"/>'
    )

    # ----- Pre-fork "trunk" line (root → fork_y) -----
    parts.append(
        f'<line x1="{root_x:.1f}" y1="{root_y:.1f}" x2="{root_x:.1f}" y2="{fork_y:.1f}" '
        f'stroke="#374151" stroke-width="3" stroke-linecap="round"/>'
    )

    # ----- Fork connectors (from root_x at fork_y to each branch's x at fork_y) -----
    for x in xs:
        parts.append(
            f'<line x1="{root_x:.1f}" y1="{fork_y:.1f}" x2="{x:.1f}" y2="{fork_y:.1f}" '
            f'stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>'
        )

    # ----- Each branch -----
    for i, branch in enumerate(branches):
        x = xs[i]
        outcomes = branch.get("outcomes") or {}
        panic = outcomes.get("panic_score")
        status = branch.get("status", "classified")
        current_round = branch.get("current_round")
        timeline = timelines.get(branch.get("label", ""), {}) or {}

        # Build tooltip preview content
        tooltip_lines = [f"<b>{_esc(branch.get('label','?'))}</b>"]
        # Status chip in tooltip
        status_label = {
            "pending": "awaiting fork",
            "created": "forked, runner not started",
            "started": "runner spawning…",
            "running": f"running round {current_round or 0}/{horizon_rounds}",
            "completed": "sim complete, classifier pending",
            "classified": "complete",
            "invalid": "invalid: " + (branch.get("invalid_reason") or "?"),
        }.get(status, status)
        tooltip_lines.append(f"<span style='color:#9ca3af'>{_esc(status_label)}</span>")
        if outcomes:
            chips = []
            for spec in schema_outcomes:
                v = outcomes.get(spec["name"])
                if v is None:
                    continue
                if isinstance(v, bool):
                    chips.append(f"{spec['name']}={'T' if v else 'F'}")
                elif isinstance(v, float):
                    chips.append(f"{spec['name']}={v:.1f}")
                else:
                    chips.append(f"{spec['name']}={v}")
            if chips:
                tooltip_lines.append(", ".join(chips))
        pert_preview = (branch.get("perturbation_text") or "")[:140]
        if pert_preview:
            tooltip_lines.append(f"<i>event:</i> {_esc(pert_preview)}")
        mood_preview = (branch.get("mood_modifier") or "")[:140]
        if mood_preview:
            tooltip_lines.append(f"<i>mood:</i> {_esc(mood_preview)}")
        tooltip_html = "<br>".join(tooltip_lines)

        valid = bool(branch.get("valid", status == "classified"))
        group_attrs = (
            f'class="wf-branch" '
            f'data-label="{_esc(branch.get("label",""))}" '
            f'data-sim-id="{_esc(branch.get("child_sim_id",""))}" '
            f'data-status="{_esc(status)}" '
            f'data-tooltip="{_esc(tooltip_html)}" '
            f'data-panic="{panic if panic is not None else ""}" '
            f'data-valid="{str(valid).lower()}"'
        )
        parts.append(f'<g {group_attrs} style="cursor:pointer">')

        # The branch line (live-aware)
        parts.append(_render_branch_line(
            branch, timeline, x, branch_top_y, branch_bottom_y,
            horizon_rounds, panic,
            current_round=current_round, branch_status=status,
        ))

        # Leaf node — only visible when sim has reached the bottom
        if status in ("completed", "classified", "invalid"):
            leaf_color = _color_for_panic(panic) if (panic is not None and valid) else "#9ca3af"
            leaf_radius = 8 if valid else 6
            parts.append(
                f'<circle cx="{x:.1f}" cy="{branch_bottom_y + 8:.1f}" r="{leaf_radius}" '
                f'fill="{leaf_color}" stroke="white" stroke-width="2"/>'
            )

        # Label below leaf
        label = branch.get("label", "?")
        label_color = "#1f2937" if status != "pending" else "#9ca3af"
        parts.append(
            f'<text x="{x:.1f}" y="{branch_bottom_y + 26:.1f}" text-anchor="end" '
            f'fill="{label_color}" font-size="11" '
            f'transform="rotate(-30 {x:.1f},{branch_bottom_y + 26:.1f})">{_esc(label)}</text>'
        )

        # Panic score chip (only when classified)
        if panic is not None and status == "classified":
            chip_color = _color_for_panic(panic)
            parts.append(
                f'<text x="{x:.1f}" y="{branch_top_y - 6:.1f}" text-anchor="middle" '
                f'fill="{chip_color}" font-size="10" font-weight="700">{panic:.1f}</text>'
            )
        elif status == "running":
            parts.append(
                f'<text x="{x:.1f}" y="{branch_top_y - 6:.1f}" text-anchor="middle" '
                f'fill="#6b7280" font-size="10">{(current_round or 0)}/{horizon_rounds}</text>'
            )

        # Invisible hit area
        parts.append(
            f'<rect x="{x - 18:.1f}" y="{branch_top_y:.1f}" width="36" '
            f'height="{branch_bottom_y - branch_top_y:.1f}" fill="transparent"/>'
        )

        parts.append("</g>")

    # ----- Root node + label -----
    parts.append(
        f'<circle cx="{root_x:.1f}" cy="{root_y:.1f}" r="9" '
        f'fill="#1f2937" stroke="white" stroke-width="2"/>'
    )
    parts.append(
        f'<text x="{root_x:.1f}" y="{root_y - 14:.1f}" text-anchor="middle" '
        f'fill="#1f2937" font-size="12" font-weight="600">parent (round 0)</text>'
    )

    # Fork-round label
    parts.append(
        f'<text x="{width - margin_right + 12:.1f}" y="{fork_y + 4:.1f}" '
        f'fill="#6b7280" font-size="11" font-style="italic">⤴ fork @ round {fork_round}</text>'
    )

    # Color legend
    legend_x = margin_left
    legend_y = height - 30
    parts.append(
        f'<text x="{legend_x:.1f}" y="{legend_y:.1f}" fill="#6b7280" font-size="11">'
        f'panic_score: '
        f'<tspan fill="#dc2626">●</tspan> 0 (alarmed) → '
        f'<tspan fill="#eab308">●</tspan> 5 (mixed) → '
        f'<tspan fill="#2563eb">●</tspan> 10 (calm)   '
        f'│   line thickness = activity per round</text>'
    )

    parts.append("</svg>")
    return "".join(parts)


# ---------------------------------------------------------------------------
# Full HTML page wrapper
# ---------------------------------------------------------------------------

def render_tree_page(
    manifest: dict,
    timelines: dict[str, dict[int, dict]],
    schema_outcomes: list[dict],
    *,
    horizon_rounds: int = 20,
    fork_round: int = 0,
    title: str = "WorldFork — branch tree",
    aggregated: dict | None = None,
) -> str:
    """Render a complete standalone HTML page with the tree + interactivity."""
    svg = render_tree_svg(
        manifest, timelines, schema_outcomes,
        horizon_rounds=horizon_rounds,
        fork_round=fork_round,
    )

    # Side panel data — full per-branch payload for click-through
    branch_payloads = []
    for b in manifest["branches"]:
        branch_payloads.append({
            "label": b.get("label"),
            "child_sim_id": b.get("child_sim_id"),
            "valid": b.get("valid"),
            "invalid_reason": b.get("invalid_reason"),
            "outcomes": b.get("outcomes") or {},
            "perturbation_text": b.get("perturbation_text") or "",
            "mood_modifier": b.get("mood_modifier") or "",
            "classifier_reasoning": b.get("classifier_reasoning") or "",
            "posts_count": b.get("posts_count"),
            "final_round": b.get("final_round"),
            "total_rounds": b.get("total_rounds"),
        })
    payload_json = json.dumps(branch_payloads, ensure_ascii=False)

    summary = ""
    if aggregated:
        n_total = aggregated.get("n_total_branches", len(manifest["branches"]))
        n_valid = aggregated.get("n_valid_branches", 0)
        primary = aggregated.get("primary_split", "")
        primary_var = aggregated.get("variables", {}).get(primary, {})
        prob = primary_var.get("probability")
        ci_low = primary_var.get("ci_low")
        ci_high = primary_var.get("ci_high")
        if prob is not None:
            summary = (
                f"<div class='wf-summary'>"
                f"<strong>{n_valid}/{n_total} valid branches.</strong> "
                f"P({primary}) = {prob*100:.1f}% "
                f"<span class='wf-ci'>[{ci_low*100:.1f}%, {ci_high*100:.1f}%]</span>"
                f"</div>"
            )

    css = """
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
       margin: 0; padding: 0; background: #f9fafb; color: #1f2937; }
header { background: white; border-bottom: 1px solid #e5e7eb; padding: 1.2em 2em; }
header h1 { margin: 0; font-size: 1.4em; }
header .meta { color: #6b7280; font-size: 0.9em; margin-top: 0.3em; }
.wf-summary { margin-top: 0.8em; padding: 0.6em 0.9em; background: #eef2ff;
              border-radius: 6px; font-size: 0.95em; display: inline-block; }
.wf-summary .wf-ci { color: #4b5563; font-size: 0.9em; margin-left: 0.4em; }
.wf-layout { display: flex; gap: 1.5em; padding: 1.5em 2em; min-height: calc(100vh - 100px); }
.wf-tree-pane { flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px;
                padding: 1em; overflow: auto; }
.wf-side { width: 360px; flex: 0 0 360px; background: white; border: 1px solid #e5e7eb;
           border-radius: 8px; padding: 1em; max-height: calc(100vh - 130px); overflow: auto; }
.wf-side h3 { margin: 0 0 0.4em 0; font-size: 1.05em; color: #1f2937; }
.wf-side .placeholder { color: #9ca3af; font-style: italic; }
.wf-side .field { margin-top: 0.9em; }
.wf-side .field-label { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.06em;
                         color: #6b7280; font-weight: 600; margin-bottom: 0.2em; }
.wf-side .field-value { font-size: 0.92em; line-height: 1.45; color: #1f2937; }
.wf-side .outcome-grid { display: grid; grid-template-columns: max-content 1fr;
                          gap: 0.25em 0.7em; font-size: 0.9em; }
.wf-side .outcome-grid .key { color: #6b7280; }
.wf-side .outcome-grid .val { font-weight: 600; }
.wf-side .blockquote { background: #f3f4f6; border-radius: 4px; padding: 0.5em 0.7em;
                        font-size: 0.88em; color: #374151; }
.wf-tooltip { position: fixed; pointer-events: none; background: #1f2937; color: white;
              padding: 0.6em 0.8em; border-radius: 6px; font-size: 0.85em;
              max-width: 360px; line-height: 1.45; opacity: 0; transition: opacity 0.12s;
              z-index: 100; box-shadow: 0 8px 22px rgba(0,0,0,0.18); }
.wf-tooltip.visible { opacity: 1; }
.wf-branch:hover line { filter: brightness(1.15); }
.wf-branch.selected line { filter: brightness(1.4) drop-shadow(0 0 4px currentColor); }
"""
    js = """
const branchData = __PAYLOAD__;
const byLabel = Object.fromEntries(branchData.map(b => [b.label, b]));

const tooltip = document.createElement('div');
tooltip.className = 'wf-tooltip';
document.body.appendChild(tooltip);

let selectedLabel = null;

function showTooltip(e, html) {
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  positionTooltip(e);
}
function positionTooltip(e) {
  const x = Math.min(e.clientX + 14, window.innerWidth - tooltip.offsetWidth - 14);
  const y = Math.min(e.clientY + 14, window.innerHeight - tooltip.offsetHeight - 14);
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function hideTooltip() { tooltip.classList.remove('visible'); }

function renderSidePanel(branch) {
  const side = document.getElementById('wf-side');
  if (!branch) {
    side.innerHTML = "<h3>Branch detail</h3><p class='placeholder'>Hover or click a branch to see its details.</p>";
    return;
  }
  const outcomes = branch.outcomes || {};
  const outcomeRows = Object.entries(outcomes).map(([k, v]) => {
    let val = v;
    if (v === null || v === undefined) val = '—';
    else if (typeof v === 'boolean') val = v ? 'true' : 'false';
    else if (typeof v === 'number') val = Number.isInteger(v) ? v : v.toFixed(2);
    return `<div class='key'>${k}</div><div class='val'>${val}</div>`;
  }).join('');
  const validChip = branch.valid
    ? "<span style='color:#16a34a;font-weight:700'>✓ valid</span>"
    : `<span style='color:#dc2626;font-weight:700'>✗ invalid</span> <span style='color:#6b7280'>(${branch.invalid_reason || ''})</span>`;
  side.innerHTML = `
    <h3>${branch.label}</h3>
    <div style='color:#6b7280;font-size:0.85em;margin-bottom:0.3em'>
      ${validChip} • ${branch.posts_count ?? 0} posts • round ${branch.final_round}/${branch.total_rounds}
    </div>
    <div class='field'>
      <div class='field-label'>Outcomes</div>
      <div class='outcome-grid'>${outcomeRows || '<i>(no data)</i>'}</div>
    </div>
    <div class='field'>
      <div class='field-label'>Perturbation event</div>
      <div class='blockquote'>${escapeHtml(branch.perturbation_text)}</div>
    </div>
    <div class='field'>
      <div class='field-label'>Mood modifier (private to agents)</div>
      <div class='blockquote'>${escapeHtml(branch.mood_modifier)}</div>
    </div>
    ${branch.classifier_reasoning ? `
      <div class='field'>
        <div class='field-label'>Classifier reasoning</div>
        <div class='blockquote'>${escapeHtml(branch.classifier_reasoning)}</div>
      </div>` : ''}
  `;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>'"]/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
}

document.querySelectorAll('.wf-branch').forEach(g => {
  g.addEventListener('mouseenter', e => {
    showTooltip(e, g.dataset.tooltip);
  });
  g.addEventListener('mousemove', e => positionTooltip(e));
  g.addEventListener('mouseleave', hideTooltip);
  g.addEventListener('click', e => {
    document.querySelectorAll('.wf-branch.selected').forEach(x => x.classList.remove('selected'));
    g.classList.add('selected');
    const label = g.dataset.label;
    selectedLabel = label;
    renderSidePanel(byLabel[label]);
  });
});

renderSidePanel(null);
"""
    js = js.replace("__PAYLOAD__", payload_json)

    fname = manifest.get('scenario_name', '?')
    fork_at = fork_round
    n_total = len(manifest['branches'])
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{_esc(title)}</title>
  <style>{css}</style>
</head>
<body>
  <header>
    <h1>{_esc(title)}</h1>
    <div class="meta">scenario: <code>{_esc(fname)}</code> &nbsp;•&nbsp; fork round: {fork_at} &nbsp;•&nbsp; {n_total} branches &nbsp;•&nbsp; horizon: {horizon_rounds} rounds</div>
    {summary}
  </header>
  <div class="wf-layout">
    <div class="wf-tree-pane">{svg}</div>
    <div id="wf-side" class="wf-side"></div>
  </div>
  <script>{js}</script>
</body>
</html>"""
