"""Inline SVG chart generation — no external deps.

Produces SVG strings that embed directly into the dashboard HTML. We use
pure-stdlib string templating because (a) installing matplotlib bloats the
venv and (b) we don't need anything fancier than bars / histograms /
heatmaps for v0.

Charts produced:
  - prob_bars: probability bar chart with Wilson 95% CI error bars
  - heatmap: per-branch outcome grid (rows=branches, cols=variables)
  - histogram: distribution of a numeric variable across branches
  - comparison_bars: side-by-side probability bars for two runs (for the
                     cross-run stability check)
"""

from __future__ import annotations

import html as html_lib
import math
from typing import Iterable

# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------

BAR_COLOR = "#3b82f6"          # blue
BAR_COLOR_RUN2 = "#f59e0b"     # amber, for run-2 in comparison
ERROR_COLOR = "#1e293b"        # slate
GRID_COLOR = "#e5e7eb"
TEXT_COLOR = "#1f2937"
AXIS_COLOR = "#6b7280"

HEAT_HOT = "#dc2626"           # red — high outcome
HEAT_COLD = "#2563eb"          # blue — low outcome
HEAT_MID = "#f5f5f5"           # neutral
HEAT_NULL = "#d1d5db"          # gray — null


def _esc(s) -> str:
    return html_lib.escape(str(s))


# ---------------------------------------------------------------------------
# Probability bar chart with CIs
# ---------------------------------------------------------------------------

def prob_bars_svg(
    items: list[dict],
    title: str = "",
    width: int = 720,
    bar_height: int = 26,
    label_col_width: int = 240,
) -> str:
    """Horizontal bar chart with Wilson-CI error bars.

    items: list of {name, probability, ci_low, ci_high, n_total}
           probability/ci_low/ci_high are 0..1 (or None to skip the bar).
    """
    n = len(items)
    if n == 0:
        return f'<svg width="{width}" height="40"><text x="20" y="25" fill="{TEXT_COLOR}">no variables</text></svg>'

    pad_top = 30 if title else 10
    pad_bottom = 30
    row_pad = 8
    h_per_row = bar_height + row_pad
    total_h = pad_top + n * h_per_row + pad_bottom
    plot_x = label_col_width
    plot_w = width - plot_x - 60  # right margin for CI labels

    parts = [f'<svg width="{width}" height="{total_h}" font-family="-apple-system, system-ui, sans-serif" font-size="13">']
    if title:
        parts.append(f'<text x="20" y="20" font-size="15" font-weight="600" fill="{TEXT_COLOR}">{_esc(title)}</text>')

    # Vertical gridlines + axis labels at 0%, 25%, 50%, 75%, 100%
    for pct in (0, 25, 50, 75, 100):
        x = plot_x + plot_w * (pct / 100)
        parts.append(f'<line x1="{x:.1f}" y1="{pad_top}" x2="{x:.1f}" y2="{total_h - pad_bottom}" stroke="{GRID_COLOR}" stroke-width="1"/>')
        parts.append(f'<text x="{x:.1f}" y="{total_h - pad_bottom + 16}" text-anchor="middle" fill="{AXIS_COLOR}" font-size="11">{pct}%</text>')

    # Each bar
    for i, item in enumerate(items):
        y = pad_top + i * h_per_row
        cy = y + bar_height / 2
        name = item.get("name", "?")
        n_total = item.get("n_total", 0)
        p = item.get("probability")

        # Label
        label_text = f'{_esc(name)}'
        if n_total is not None:
            label_text += f' <tspan fill="{AXIS_COLOR}" font-size="11">(n={n_total})</tspan>'
        parts.append(f'<text x="{label_col_width - 12}" y="{cy + 4}" text-anchor="end" fill="{TEXT_COLOR}">{label_text}</text>')

        if p is None or n_total == 0:
            parts.append(f'<text x="{plot_x + 8}" y="{cy + 4}" fill="{AXIS_COLOR}" font-style="italic">no data</text>')
            continue

        # Bar
        bar_w = max(1.0, plot_w * p)
        parts.append(f'<rect x="{plot_x}" y="{y}" width="{bar_w:.1f}" height="{bar_height}" fill="{BAR_COLOR}" rx="3"/>')
        # Probability text inside or after
        ptext = f'{p*100:.1f}%'
        if bar_w > 50:
            parts.append(f'<text x="{plot_x + bar_w - 6:.1f}" y="{cy + 4}" text-anchor="end" fill="white" font-weight="600">{ptext}</text>')
        else:
            parts.append(f'<text x="{plot_x + bar_w + 6:.1f}" y="{cy + 4}" fill="{TEXT_COLOR}" font-weight="600">{ptext}</text>')

        # CI error bar (Wilson)
        lo = item.get("ci_low")
        hi = item.get("ci_high")
        if lo is not None and hi is not None:
            x_lo = plot_x + plot_w * lo
            x_hi = plot_x + plot_w * hi
            parts.append(f'<line x1="{x_lo:.1f}" y1="{cy}" x2="{x_hi:.1f}" y2="{cy}" stroke="{ERROR_COLOR}" stroke-width="1.6"/>')
            parts.append(f'<line x1="{x_lo:.1f}" y1="{cy - 5}" x2="{x_lo:.1f}" y2="{cy + 5}" stroke="{ERROR_COLOR}" stroke-width="1.6"/>')
            parts.append(f'<line x1="{x_hi:.1f}" y1="{cy - 5}" x2="{x_hi:.1f}" y2="{cy + 5}" stroke="{ERROR_COLOR}" stroke-width="1.6"/>')

    parts.append('</svg>')
    return "".join(parts)


# ---------------------------------------------------------------------------
# Heatmap of per-branch outcomes
# ---------------------------------------------------------------------------

def _color_for_value(v, vmin: float, vmax: float, is_bool: bool) -> str:
    """Map a numeric or bool to a color along the cold→neutral→hot scale."""
    if v is None:
        return HEAT_NULL
    if is_bool:
        return HEAT_HOT if v else HEAT_COLD
    if vmax == vmin:
        return HEAT_MID
    t = (float(v) - vmin) / (vmax - vmin)  # 0..1
    t = max(0.0, min(1.0, t))
    # Linear interp on cold→mid (0..0.5) → mid→hot (0.5..1)
    if t <= 0.5:
        c0, c1 = HEAT_COLD, HEAT_MID
        local = t * 2
    else:
        c0, c1 = HEAT_MID, HEAT_HOT
        local = (t - 0.5) * 2
    return _interp_color(c0, c1, local)


def _interp_color(a: str, b: str, t: float) -> str:
    ar, ag, ab = int(a[1:3], 16), int(a[3:5], 16), int(a[5:7], 16)
    br, bg, bb = int(b[1:3], 16), int(b[3:5], 16), int(b[5:7], 16)
    rr = int(ar + (br - ar) * t)
    rg = int(ag + (bg - ag) * t)
    rb = int(ab + (bb - ab) * t)
    return f"#{rr:02x}{rg:02x}{rb:02x}"


def heatmap_svg(
    branches: list[dict],
    variables: list[dict],
    title: str = "",
    width: int = 900,
    cell_h: int = 32,
    label_col_width: int = 230,
) -> str:
    """Per-branch outcome heatmap.

    branches: list of {label, outcomes (dict)}
    variables: list of {name, type, optional range}
    """
    if not branches or not variables:
        return ""

    pad_top = 90 if title else 70  # extra space for column headers (rotated)
    pad_bottom = 30
    n_rows = len(branches)
    n_cols = len(variables)
    cell_w = (width - label_col_width - 20) / n_cols
    total_h = pad_top + n_rows * cell_h + pad_bottom

    # Normalize numeric cols
    norms = {}
    for v in variables:
        if v["type"] in ("int", "float", "numeric"):
            vals = [b["outcomes"].get(v["name"]) for b in branches if b.get("outcomes")]
            vals = [float(x) for x in vals if x is not None]
            if vals:
                norms[v["name"]] = (min(vals), max(vals))

    parts = [f'<svg width="{width}" height="{total_h}" font-family="-apple-system, system-ui, sans-serif" font-size="12">']
    if title:
        parts.append(f'<text x="20" y="20" font-size="15" font-weight="600" fill="{TEXT_COLOR}">{_esc(title)}</text>')

    # Column headers (rotated)
    for j, v in enumerate(variables):
        cx = label_col_width + cell_w * j + cell_w / 2
        # rotated text
        parts.append(
            f'<text x="{cx:.1f}" y="{pad_top - 8}" text-anchor="end" fill="{TEXT_COLOR}" '
            f'transform="rotate(-35 {cx:.1f},{pad_top - 8})">{_esc(v["name"])}</text>'
        )

    # Rows
    for i, b in enumerate(branches):
        y = pad_top + i * cell_h
        cy = y + cell_h / 2
        # Row label
        label = b.get("label", "?")
        valid_chip = "✓" if b.get("valid") else "✗"
        valid_color = "#16a34a" if b.get("valid") else "#dc2626"
        parts.append(f'<text x="{label_col_width - 22}" y="{cy + 4}" text-anchor="end" fill="{TEXT_COLOR}">{_esc(label)}</text>')
        parts.append(f'<text x="{label_col_width - 8}" y="{cy + 4}" text-anchor="end" fill="{valid_color}" font-weight="700">{valid_chip}</text>')

        outcomes = b.get("outcomes") or {}
        for j, v in enumerate(variables):
            x = label_col_width + cell_w * j
            val = outcomes.get(v["name"])
            is_bool = v["type"] == "bool"
            if val is not None and is_bool:
                vmin, vmax = 0, 1
            elif v["name"] in norms:
                vmin, vmax = norms[v["name"]]
            else:
                vmin, vmax = 0, 1
            color = _color_for_value(val, vmin, vmax, is_bool)
            parts.append(f'<rect x="{x:.1f}" y="{y}" width="{cell_w:.1f}" height="{cell_h}" fill="{color}" stroke="white" stroke-width="1"/>')
            # Cell label
            if val is None:
                txt = "—"
            elif is_bool:
                txt = "T" if val else "F"
            elif isinstance(val, float):
                txt = f"{val:.1f}"
            else:
                txt = str(val)
            # White text on dark backgrounds
            tcolor = "white" if (is_bool and val) or (not is_bool and val is not None and (vmax - vmin > 0) and (float(val) - vmin) / max(vmax - vmin, 1e-9) > 0.6) else TEXT_COLOR
            parts.append(f'<text x="{x + cell_w/2:.1f}" y="{cy + 4}" text-anchor="middle" font-size="11" fill="{tcolor}">{_esc(txt)}</text>')

    parts.append('</svg>')
    return "".join(parts)


# ---------------------------------------------------------------------------
# Histogram for a numeric variable
# ---------------------------------------------------------------------------

def histogram_svg(
    name: str,
    values: list[float],
    bins: int = 8,
    width: int = 480,
    height: int = 180,
    range_hint: tuple[float, float] | None = None,
) -> str:
    """Histogram of a numeric variable."""
    vals = [float(v) for v in values if v is not None]
    if not vals:
        return f'<svg width="{width}" height="{height}"><text x="20" y="25" fill="{TEXT_COLOR}">{_esc(name)}: no data</text></svg>'

    if range_hint:
        vmin, vmax = range_hint
    else:
        vmin, vmax = min(vals), max(vals)
    if vmin == vmax:
        vmin, vmax = vmin - 0.5, vmax + 0.5

    edges = [vmin + (vmax - vmin) * i / bins for i in range(bins + 1)]
    counts = [0] * bins
    for v in vals:
        idx = min(bins - 1, int((v - vmin) / (vmax - vmin) * bins))
        counts[idx] += 1
    cmax = max(counts)

    pad = 36
    plot_w = width - 2 * pad
    plot_h = height - 2 * pad
    bar_w = plot_w / bins

    parts = [f'<svg width="{width}" height="{height}" font-family="-apple-system, system-ui, sans-serif" font-size="11">']
    parts.append(f'<text x="{width/2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="{TEXT_COLOR}">{_esc(name)}</text>')

    # Axes
    parts.append(f'<line x1="{pad}" y1="{height - pad}" x2="{width - pad}" y2="{height - pad}" stroke="{AXIS_COLOR}" stroke-width="1"/>')
    parts.append(f'<line x1="{pad}" y1="{pad}" x2="{pad}" y2="{height - pad}" stroke="{AXIS_COLOR}" stroke-width="1"/>')

    # Bars
    for i, c in enumerate(counts):
        if c == 0:
            continue
        h_px = (plot_h * c / cmax) if cmax > 0 else 0
        x = pad + bar_w * i
        y = height - pad - h_px
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w - 1:.1f}" height="{h_px:.1f}" fill="{BAR_COLOR}"/>')
        parts.append(f'<text x="{x + bar_w/2:.1f}" y="{y - 3:.1f}" text-anchor="middle" font-size="10" fill="{TEXT_COLOR}">{c}</text>')

    # Range labels
    parts.append(f'<text x="{pad}" y="{height - pad + 14}" font-size="10" fill="{AXIS_COLOR}">{vmin:.1f}</text>')
    parts.append(f'<text x="{width - pad}" y="{height - pad + 14}" text-anchor="end" font-size="10" fill="{AXIS_COLOR}">{vmax:.1f}</text>')

    # Stats line
    mean = sum(vals) / len(vals)
    parts.append(
        f'<text x="{width - pad}" y="32" text-anchor="end" font-size="11" fill="{AXIS_COLOR}">'
        f'n={len(vals)} mean={mean:.2f} min={min(vals):.1f} max={max(vals):.1f}</text>'
    )

    parts.append('</svg>')
    return "".join(parts)


# ---------------------------------------------------------------------------
# Cross-run comparison bars
# ---------------------------------------------------------------------------

def comparison_bars_svg(
    pairs: list[dict],
    title: str = "Cross-run stability check",
    width: int = 760,
    bar_height: int = 18,
    label_col_width: int = 240,
) -> str:
    """Side-by-side probability bars for two runs.

    pairs: list of {name, run1: {p, lo, hi, n}, run2: {p, lo, hi, n}}.
           Each binary variable becomes one row with two bars stacked vertically
           (run-1 blue on top, run-2 amber below) so CIs can overlap visually.
    """
    n = len(pairs)
    if n == 0:
        return f'<svg width="{width}" height="40"><text x="20" y="25" fill="{TEXT_COLOR}">no comparison data</text></svg>'

    pad_top = 50 if title else 16
    pad_bottom = 36
    row_inner = bar_height * 2 + 4
    row_pad = 12
    row_h = row_inner + row_pad
    total_h = pad_top + n * row_h + pad_bottom
    plot_x = label_col_width
    plot_w = width - plot_x - 100

    parts = [f'<svg width="{width}" height="{total_h}" font-family="-apple-system, system-ui, sans-serif" font-size="13">']
    if title:
        parts.append(f'<text x="20" y="22" font-size="15" font-weight="600" fill="{TEXT_COLOR}">{_esc(title)}</text>')
        parts.append(f'<text x="20" y="40" fill="{AXIS_COLOR}" font-size="11">'
                     f'<tspan fill="{BAR_COLOR}">▆</tspan> run 1   '
                     f'<tspan fill="{BAR_COLOR_RUN2}">▆</tspan> run 2   '
                     f'(<tspan fill="#16a34a" font-weight="700">✓</tspan> = run 2 within run 1\'s CI)</text>')

    # Gridlines
    for pct in (0, 25, 50, 75, 100):
        x = plot_x + plot_w * (pct / 100)
        parts.append(f'<line x1="{x:.1f}" y1="{pad_top}" x2="{x:.1f}" y2="{total_h - pad_bottom}" stroke="{GRID_COLOR}" stroke-width="1"/>')
        parts.append(f'<text x="{x:.1f}" y="{total_h - pad_bottom + 16}" text-anchor="middle" fill="{AXIS_COLOR}" font-size="11">{pct}%</text>')

    for i, item in enumerate(pairs):
        y = pad_top + i * row_h
        name = item.get("name", "?")
        r1 = item.get("run1") or {}
        r2 = item.get("run2") or {}

        # Row label
        parts.append(f'<text x="{label_col_width - 12}" y="{y + row_inner/2 + 4}" text-anchor="end" fill="{TEXT_COLOR}">{_esc(name)}</text>')

        # Stability indicator: is run2's p within run1's CI?
        ok = None
        p1, lo1, hi1 = r1.get("p"), r1.get("lo"), r1.get("hi")
        p2 = r2.get("p")
        if p1 is not None and lo1 is not None and hi1 is not None and p2 is not None:
            ok = (lo1 <= p2 <= hi1)
        if ok is True:
            parts.append(f'<text x="{width - 50}" y="{y + row_inner/2 + 4}" font-weight="700" fill="#16a34a">✓</text>')
        elif ok is False:
            parts.append(f'<text x="{width - 50}" y="{y + row_inner/2 + 4}" font-weight="700" fill="#dc2626">✗</text>')

        # Run 1 bar (blue, top)
        _draw_bar(parts, plot_x, y, plot_w, bar_height, r1, BAR_COLOR)
        # Run 2 bar (amber, bottom)
        _draw_bar(parts, plot_x, y + bar_height + 4, plot_w, bar_height, r2, BAR_COLOR_RUN2)

    parts.append('</svg>')
    return "".join(parts)


def _draw_bar(parts: list, plot_x, y, plot_w, bar_h, run: dict, color: str):
    p = run.get("p")
    if p is None:
        return
    bar_w = max(1.0, plot_w * p)
    parts.append(f'<rect x="{plot_x}" y="{y}" width="{bar_w:.1f}" height="{bar_h}" fill="{color}" rx="2" opacity="0.9"/>')
    ptext = f'{p*100:.0f}%'
    if bar_w > 36:
        parts.append(f'<text x="{plot_x + bar_w - 4:.1f}" y="{y + bar_h/2 + 4}" text-anchor="end" fill="white" font-size="11" font-weight="600">{ptext}</text>')
    else:
        parts.append(f'<text x="{plot_x + bar_w + 4:.1f}" y="{y + bar_h/2 + 4}" fill="{TEXT_COLOR}" font-size="11">{ptext}</text>')

    lo, hi = run.get("lo"), run.get("hi")
    if lo is not None and hi is not None:
        x_lo = plot_x + plot_w * lo
        x_hi = plot_x + plot_w * hi
        cy = y + bar_h / 2
        parts.append(f'<line x1="{x_lo:.1f}" y1="{cy}" x2="{x_hi:.1f}" y2="{cy}" stroke="{ERROR_COLOR}" stroke-width="1.4"/>')
        parts.append(f'<line x1="{x_lo:.1f}" y1="{cy - 4}" x2="{x_lo:.1f}" y2="{cy + 4}" stroke="{ERROR_COLOR}" stroke-width="1.4"/>')
        parts.append(f'<line x1="{x_hi:.1f}" y1="{cy - 4}" x2="{x_hi:.1f}" y2="{cy + 4}" stroke="{ERROR_COLOR}" stroke-width="1.4"/>')
