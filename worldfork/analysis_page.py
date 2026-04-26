"""Data-analysis page for a completed WorldFork run.

Separate from the live tree (which is for *watching* the run). This page
is for *digging into* the results: large hover-interactive histograms,
per-branch dot strips, sortable comparison table, cross-outcome scatter.

Polls the same /api/run/<id>/lineage endpoint — when manifest_present
is true, every leaf has its outcomes, distributions are computed
server-side, and we just render them.
"""

from __future__ import annotations


def render_analysis_page(run_id: str, title: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WorldFork analysis — {title}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #0b1020; color: #e5e7eb;
           font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }}
    header {{ background: #111827; border-bottom: 1px solid #1f2937;
              padding: 0.9em 1.5em; display: flex; justify-content: space-between;
              align-items: center; }}
    header h1 {{ margin: 0; font-size: 1.1em; font-weight: 600; }}
    header .meta {{ color: #9ca3af; font-size: 0.85em; margin-top: 0.15em; }}
    header .links a {{ color: #818cf8; text-decoration: none; font-size: 0.85em;
                        margin-left: 1em; }}
    header .links a:hover {{ text-decoration: underline; }}

    .summary-bar {{ background: #0f172a; border-bottom: 1px solid #1f2937;
                     padding: 0.7em 1.5em; display: flex; gap: 1em; flex-wrap: wrap;
                     font-size: 0.85em; }}
    .summary-bar .pill {{ background: #1f2937; padding: 0.3em 0.7em;
                            border-radius: 4px; border: 1px solid #374151; }}
    .summary-bar .pill strong {{ color: #f3f4f6; }}

    main {{ max-width: 1400px; margin: 0 auto; padding: 1.5em; }}
    section {{ margin-bottom: 2em; }}
    section > h2 {{ font-size: 1em; color: #cbd5e1; margin: 0 0 0.8em 0;
                     text-transform: uppercase; letter-spacing: 0.05em;
                     font-weight: 600; border-bottom: 1px solid #1f2937;
                     padding-bottom: 0.4em; }}

    .grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }}

    .chart-card {{ background: #111827; border: 1px solid #1f2937;
                    border-radius: 8px; padding: 1em; }}
    .chart-card h3 {{ margin: 0 0 0.4em 0; font-size: 0.95em; color: #f3f4f6;
                       font-family: ui-monospace, monospace; }}
    .chart-card .desc {{ font-size: 0.78em; color: #94a3b8; line-height: 1.45;
                          margin-bottom: 0.8em; }}
    .chart-card .stats {{ display: flex; gap: 0.6em; margin-top: 0.6em;
                           flex-wrap: wrap; font-size: 0.8em; }}
    .chart-card .stats span {{ background: #0b1020; padding: 0.25em 0.55em;
                                border-radius: 3px; border: 1px solid #1f2937;
                                color: #cbd5e1; }}
    .chart-card .stats strong {{ color: #f3f4f6; font-weight: 600; }}

    /* Branch table */
    table.branch-table {{ width: 100%; border-collapse: collapse;
                            font-size: 0.85em; }}
    table.branch-table th, table.branch-table td {{
      padding: 0.45em 0.7em; text-align: left; border-bottom: 1px solid #1f2937;
    }}
    table.branch-table th {{ background: #111827; color: #cbd5e1;
                              cursor: pointer; user-select: none;
                              position: sticky; top: 0; }}
    table.branch-table th:hover {{ background: #1f2937; }}
    table.branch-table th.sorted-asc::after {{ content: ' ↑'; color: #818cf8; }}
    table.branch-table th.sorted-desc::after {{ content: ' ↓'; color: #818cf8; }}
    table.branch-table td.label {{ font-family: ui-monospace, monospace;
                                     font-size: 0.85em; max-width: 250px;
                                     overflow: hidden; text-overflow: ellipsis;
                                     white-space: nowrap; }}
    table.branch-table td.numeric {{ text-align: right;
                                       font-family: ui-monospace, monospace; }}
    table.branch-table td.bool-true {{ color: #22c55e; font-weight: 600; }}
    table.branch-table td.bool-false {{ color: #ef4444; }}
    table.branch-table tr.invalid {{ opacity: 0.4; }}
    table.branch-table tr:hover td {{ background: #161e2e; }}

    /* Cell cell-bg gradient (driven by outcome value vs range) */
    table.branch-table td.value-cell {{ position: relative; }}
    table.branch-table td.value-cell .v-bg {{
      position: absolute; left: 0; top: 0; height: 100%;
      background: rgba(99, 102, 241, 0.18); pointer-events: none; z-index: 0;
    }}
    table.branch-table td.value-cell .v-text {{ position: relative; z-index: 1; }}

    /* Tooltip */
    #tt {{ position: fixed; background: #111827; border: 1px solid #4b5563;
            padding: 0.55em 0.75em; border-radius: 4px; font-size: 0.8em;
            font-family: ui-monospace, monospace; pointer-events: none;
            z-index: 100; display: none; max-width: 320px; line-height: 1.4; }}
    #tt strong {{ color: #fbbf24; }}

    .empty {{ color: #6b7280; font-style: italic; padding: 2em; text-align: center; }}

    /* Cross-outcome scatter */
    .scatter-controls {{ display: flex; gap: 0.5em; align-items: center;
                          margin-bottom: 0.8em; font-size: 0.85em; color: #cbd5e1; }}
    .scatter-controls select {{ background: #0b1020; color: #e5e7eb;
                                  border: 1px solid #374151; padding: 0.3em 0.5em;
                                  border-radius: 3px; font-family: ui-monospace, monospace; }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>WorldFork analysis</h1>
      <div class="meta">{title}</div>
    </div>
    <div class="links">
      <a href="/run/{run_id}">← back to live tree</a>
      <a href="/">demo home</a>
    </div>
  </header>
  <div class="summary-bar" id="summary"></div>
  <main>
    <div id="status" class="empty">loading…</div>
    <section id="histograms-section" style="display:none">
      <h2>outcome distributions</h2>
      <div id="histograms" class="grid-2"></div>
    </section>
    <section id="scatter-section" style="display:none">
      <h2>cross-outcome scatter</h2>
      <div class="chart-card">
        <div class="scatter-controls">
          <span>x-axis:</span>
          <select id="scatter-x"></select>
          <span>y-axis:</span>
          <select id="scatter-y"></select>
          <span style="color:#6b7280">— each dot = one branch; hover for details</span>
        </div>
        <div id="scatter"></div>
      </div>
    </section>
    <section id="table-section" style="display:none">
      <h2>per-branch outcomes</h2>
      <div class="chart-card" style="overflow-x:auto">
        <table id="branch-table" class="branch-table"></table>
      </div>
    </section>
  </main>
  <div id="tt"></div>

  <script>
    const RUN_ID = {run_id!r};
    const tt = document.getElementById('tt');

    function showTt(html, e) {{
      tt.innerHTML = html;
      tt.style.display = 'block';
      moveTt(e);
    }}
    function moveTt(e) {{
      // Position so it doesn't overflow the viewport
      const w = tt.offsetWidth || 200;
      const h = tt.offsetHeight || 60;
      let x = e.clientX + 12, y = e.clientY + 12;
      if (x + w > window.innerWidth) x = e.clientX - w - 12;
      if (y + h > window.innerHeight) y = e.clientY - h - 12;
      tt.style.left = x + 'px';
      tt.style.top  = y + 'px';
    }}
    function hideTt() {{ tt.style.display = 'none'; }}

    function fmt(x, dp=2) {{
      if (x == null || Number.isNaN(x)) return '—';
      if (Math.abs(x) >= 1000) return x.toFixed(0);
      if (Math.abs(x) >= 100) return x.toFixed(1);
      if (Math.abs(x) >= 10) return x.toFixed(dp);
      return x.toFixed(dp);
    }}

    // green→amber→red gradient over t in [0,1]
    function colorForT(t) {{
      t = Math.max(0, Math.min(1, t));
      if (t < 0.5) {{
        const k = t / 0.5;
        return `rgb(${{Math.round(34 + k*(251-34))}}, ${{Math.round(197 + k*(191-197))}}, ${{Math.round(94 + k*(36-94))}})`;
      }}
      const k = (t - 0.5) / 0.5;
      return `rgb(${{Math.round(251 + k*(239-251))}}, ${{Math.round(191 + k*(68-191))}}, ${{Math.round(36 + k*(68-36))}})`;
    }}

    async function load() {{
      const r = await fetch(`/api/run/${{RUN_ID}}/lineage`);
      const data = await r.json();
      render(data);
      // re-poll if not yet complete (in case the run is still classifying)
      if (!data.manifest_present) setTimeout(load, 5000);
    }}

    function render(data) {{
      // Summary bar
      const sum = document.getElementById('summary');
      const branches = collectLeaves(data.tree);
      const valid = branches.filter(b => b.valid !== false);
      const completed = branches.filter(b => b.runner_status === 'completed').length;
      sum.innerHTML = `
        <span class="pill"><strong>${{branches.length}}</strong> total branches</span>
        <span class="pill"><strong>${{valid.length}}</strong> valid</span>
        <span class="pill"><strong>${{completed}}</strong> runner completed</span>
        <span class="pill">phase <strong>${{data.phase || '?'}}</strong></span>
        <span class="pill">root <strong>${{data.root_sim_id || '?'}}</strong></span>
      `;

      const status = document.getElementById('status');

      if (!data.manifest_present) {{
        status.style.display = 'block';
        status.textContent = 'classifier output not yet available — '
          + 'this page polls every 5s and renders as soon as the run finishes.';
        return;
      }}
      status.style.display = 'none';

      const dists = data.distributions || {{}};
      const schema = data.outcome_schema || [];
      const numericVars = schema.filter(v =>
        ['float', 'int', 'number'].includes((v.type || '').toLowerCase()) && dists[v.name]);

      if (numericVars.length === 0) {{
        document.getElementById('histograms-section').style.display = 'none';
      }} else {{
        document.getElementById('histograms-section').style.display = 'block';
        const root = document.getElementById('histograms');
        root.innerHTML = '';
        for (const v of numericVars) {{
          root.appendChild(buildHistogramCard(v, dists[v.name], branches));
        }}
      }}

      // Scatter
      if (numericVars.length >= 2) {{
        document.getElementById('scatter-section').style.display = 'block';
        const xs = document.getElementById('scatter-x');
        const ys = document.getElementById('scatter-y');
        const cur = {{ x: xs.value, y: ys.value }};
        xs.innerHTML = numericVars.map(v => `<option value="${{v.name}}">${{v.name}}</option>`).join('');
        ys.innerHTML = numericVars.map(v => `<option value="${{v.name}}">${{v.name}}</option>`).join('');
        xs.value = cur.x && numericVars.some(v=>v.name===cur.x) ? cur.x : numericVars[0].name;
        ys.value = cur.y && numericVars.some(v=>v.name===cur.y) ? cur.y : numericVars[1].name;
        const draw = () => drawScatter(numericVars, branches, xs.value, ys.value);
        xs.onchange = draw; ys.onchange = draw;
        draw();
      }}

      // Branch table
      document.getElementById('table-section').style.display = 'block';
      buildBranchTable(schema, branches);
    }}

    function collectLeaves(tree) {{
      const out = [];
      function walk(n) {{
        if (!n.children || n.children.length === 0) {{
          if (n.outcomes) out.push(n);
        }} else {{
          for (const c of n.children) walk(c);
        }}
      }}
      walk(tree);
      return out;
    }}

    // ---- Histogram with axes + hover -----------------------------------
    function buildHistogramCard(varDef, dist, branches) {{
      const card = document.createElement('div');
      card.className = 'chart-card';

      const range = varDef.range || [dist.min, dist.max];
      const [lo, hi] = range;
      const nBins = 16;
      const binW = (hi - lo) / nBins;
      const bins = new Array(nBins).fill(0).map((_, i) => ({{
        idx: i, lo: lo + i*binW, hi: lo + (i+1)*binW,
        count: 0, branches: [],
      }}));
      for (const b of branches) {{
        const v = (b.outcomes || {{}})[varDef.name];
        if (typeof v !== 'number') continue;
        const idx = Math.min(nBins - 1, Math.max(0, Math.floor((v - lo) / binW)));
        bins[idx].count++;
        bins[idx].branches.push({{ label: b.perturbation_label || b.label, v }});
      }}
      const maxBin = Math.max(...bins.map(b => b.count), 1);

      const W = 600, H = 280;
      const M = {{ left: 50, right: 24, top: 18, bottom: 38 }};
      const plotW = W - M.left - M.right;
      const plotH = H - M.top - M.bottom;

      // Build SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('viewBox', `0 0 ${{W}} ${{H}}`);
      svg.style.maxWidth = W + 'px';

      // Y gridlines + labels
      const yTicks = makeNiceTicks(0, maxBin, 5);
      for (const yv of yTicks) {{
        const y = M.top + plotH - (yv / maxBin) * plotH;
        svg.appendChild(line(M.left, y, M.left + plotW, y, '#1f2937', 1));
        svg.appendChild(text(M.left - 6, y + 4, String(yv), '#6b7280', 11, 'end'));
      }}

      // Bars
      const xOf = v => M.left + ((v - lo) / (hi - lo)) * plotW;
      for (const b of bins) {{
        const x = xOf(b.lo) + 1;
        const w = xOf(b.hi) - xOf(b.lo) - 2;
        const h = (b.count / maxBin) * plotH;
        const y = M.top + plotH - h;
        const t = (b.lo + b.hi) / 2;
        const tNorm = (t - lo) / (hi - lo);
        const color = colorForT(tNorm);
        const rect = rectEl(x, y, w, h, color);
        rect.style.cursor = 'pointer';
        rect.onmouseenter = (e) => {{
          const lbls = b.branches.map(br => `  • ${{br.label}}: ${{fmt(br.v, 3)}}`).join('<br>');
          showTt(`<strong>[${{fmt(b.lo, 2)}}, ${{fmt(b.hi, 2)}}]</strong><br>${{b.count}} branch${{b.count !== 1 ? 'es' : ''}}<br>${{lbls}}`, e);
        }};
        rect.onmousemove = moveTt;
        rect.onmouseleave = hideTt;
        svg.appendChild(rect);
      }}

      // Median + mean lines
      const medX = xOf(dist.median);
      const meanX = xOf(dist.mean);
      svg.appendChild(line(medX, M.top, medX, M.top + plotH, '#fbbf24', 2));
      svg.appendChild(text(medX, M.top - 5, `med ${{fmt(dist.median)}}`, '#fbbf24', 10, 'middle'));
      svg.appendChild(line(meanX, M.top, meanX, M.top + plotH, '#a78bfa', 1.5, '4 3'));

      // IQR shaded band (below the plot area)
      const iqrY = M.top + plotH + 4;
      svg.appendChild(rectEl(xOf(dist.q25), iqrY, xOf(dist.q75) - xOf(dist.q25), 6,
                              '#3b82f6', 0.5));

      // X-axis ticks
      const xTicks = makeNiceTicks(lo, hi, 6);
      for (const xv of xTicks) {{
        const x = xOf(xv);
        svg.appendChild(line(x, M.top + plotH, x, M.top + plotH + 4, '#4b5563', 1));
        svg.appendChild(text(x, M.top + plotH + 28, fmt(xv), '#9ca3af', 11, 'middle'));
      }}
      // Axis baseline
      svg.appendChild(line(M.left, M.top + plotH, M.left + plotW, M.top + plotH, '#374151', 1));

      // Y-axis label (rotated)
      const yLab = text(14, M.top + plotH/2, 'count', '#9ca3af', 11, 'middle');
      yLab.setAttribute('transform', `rotate(-90 14 ${{M.top + plotH/2}})`);
      svg.appendChild(yLab);
      // X-axis label
      svg.appendChild(text(M.left + plotW/2, H - 4, varDef.name, '#9ca3af', 11, 'middle'));

      // Render header
      card.innerHTML = `
        <h3>${{varDef.name}}</h3>
        <div class="desc">${{(varDef.description || '').slice(0, 320)}}</div>
      `;
      card.appendChild(svg);
      const stats = document.createElement('div');
      stats.className = 'stats';
      stats.innerHTML = `
        <span>n <strong>${{dist.n}}</strong></span>
        <span>median <strong>${{fmt(dist.median, 3)}}</strong></span>
        <span>mean <strong>${{fmt(dist.mean, 3)}}</strong></span>
        <span>IQR [<strong>${{fmt(dist.q25, 3)}}</strong>, <strong>${{fmt(dist.q75, 3)}}</strong>]</span>
        <span>range [<strong>${{fmt(dist.min, 3)}}</strong>, <strong>${{fmt(dist.max, 3)}}</strong>]</span>
        <span>spread <strong>${{fmt(dist.q75 - dist.q25, 3)}}</strong></span>
      `;
      card.appendChild(stats);
      return card;
    }}

    function makeNiceTicks(lo, hi, target) {{
      const span = hi - lo;
      if (span === 0) return [lo];
      const rough = span / target;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      let step;
      if (norm < 1.5) step = 1 * mag;
      else if (norm < 3) step = 2 * mag;
      else if (norm < 7) step = 5 * mag;
      else step = 10 * mag;
      const out = [];
      const start = Math.ceil(lo / step) * step;
      for (let v = start; v <= hi + 1e-9; v += step) {{
        out.push(Math.round(v / step) * step);
      }}
      return out;
    }}

    function line(x1, y1, x2, y2, stroke, sw=1, dash=null) {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', x1); el.setAttribute('y1', y1);
      el.setAttribute('x2', x2); el.setAttribute('y2', y2);
      el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', sw);
      if (dash) el.setAttribute('stroke-dasharray', dash);
      return el;
    }}
    function rectEl(x, y, w, h, fill, opacity=1) {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', x); el.setAttribute('y', y);
      el.setAttribute('width', w); el.setAttribute('height', h);
      el.setAttribute('fill', fill);
      if (opacity !== 1) el.setAttribute('opacity', opacity);
      return el;
    }}
    function text(x, y, str, fill, size=11, anchor='start') {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', x); el.setAttribute('y', y);
      el.setAttribute('fill', fill); el.setAttribute('font-size', size);
      el.setAttribute('text-anchor', anchor);
      el.setAttribute('font-family', 'ui-monospace, monospace');
      el.textContent = str;
      return el;
    }}
    function circle(x, y, r, fill, stroke) {{
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', r);
      el.setAttribute('fill', fill);
      if (stroke) el.setAttribute('stroke', stroke);
      return el;
    }}

    // ---- Scatter -------------------------------------------------------
    function drawScatter(numericVars, branches, xName, yName) {{
      const xVar = numericVars.find(v => v.name === xName);
      const yVar = numericVars.find(v => v.name === yName);
      const xs = branches.map(b => (b.outcomes || {{}})[xName]).filter(v => typeof v === 'number');
      const ys = branches.map(b => (b.outcomes || {{}})[yName]).filter(v => typeof v === 'number');
      const xRange = xVar.range || [Math.min(...xs), Math.max(...xs)];
      const yRange = yVar.range || [Math.min(...ys), Math.max(...ys)];

      const W = 800, H = 360;
      const M = {{ left: 60, right: 24, top: 18, bottom: 44 }};
      const plotW = W - M.left - M.right;
      const plotH = H - M.top - M.bottom;
      const xOf = v => M.left + ((v - xRange[0]) / (xRange[1] - xRange[0])) * plotW;
      const yOf = v => M.top + plotH - ((v - yRange[0]) / (yRange[1] - yRange[0])) * plotH;

      const root = document.getElementById('scatter');
      root.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('viewBox', `0 0 ${{W}} ${{H}}`);
      svg.style.maxWidth = W + 'px';

      // Gridlines
      const xTicks = makeNiceTicks(xRange[0], xRange[1], 6);
      const yTicks = makeNiceTicks(yRange[0], yRange[1], 6);
      for (const xv of xTicks) {{
        const x = xOf(xv);
        svg.appendChild(line(x, M.top, x, M.top + plotH, '#1f2937', 1));
        svg.appendChild(text(x, M.top + plotH + 16, fmt(xv), '#9ca3af', 10, 'middle'));
      }}
      for (const yv of yTicks) {{
        const y = yOf(yv);
        svg.appendChild(line(M.left, y, M.left + plotW, y, '#1f2937', 1));
        svg.appendChild(text(M.left - 6, y + 4, fmt(yv), '#9ca3af', 10, 'end'));
      }}

      // Axes
      svg.appendChild(line(M.left, M.top + plotH, M.left + plotW, M.top + plotH, '#374151', 1));
      svg.appendChild(line(M.left, M.top, M.left, M.top + plotH, '#374151', 1));
      svg.appendChild(text(M.left + plotW/2, H - 6, xName, '#cbd5e1', 12, 'middle'));
      const yLab = text(16, M.top + plotH/2, yName, '#cbd5e1', 12, 'middle');
      yLab.setAttribute('transform', `rotate(-90 16 ${{M.top + plotH/2}})`);
      svg.appendChild(yLab);

      // Dots
      for (const b of branches) {{
        const xv = (b.outcomes || {{}})[xName];
        const yv = (b.outcomes || {{}})[yName];
        if (typeof xv !== 'number' || typeof yv !== 'number') continue;
        const cx = xOf(xv), cy = yOf(yv);
        const c = circle(cx, cy, 6, 'rgba(129, 140, 248, 0.8)', '#fff');
        c.setAttribute('stroke-width', 1.5);
        c.style.cursor = 'pointer';
        c.onmouseenter = (e) => {{
          showTt(`<strong>${{b.perturbation_label || b.label}}</strong><br>${{xName}}: ${{fmt(xv, 3)}}<br>${{yName}}: ${{fmt(yv, 3)}}<br>sim_id: ${{b.sim_id}}`, e);
          c.setAttribute('r', 9);
        }};
        c.onmousemove = moveTt;
        c.onmouseleave = () => {{ hideTt(); c.setAttribute('r', 6); }};
        svg.appendChild(c);
      }}

      // Pearson correlation
      const pairs = branches.map(b => [
        (b.outcomes || {{}})[xName],
        (b.outcomes || {{}})[yName],
      ]).filter(p => typeof p[0] === 'number' && typeof p[1] === 'number');
      let corrText = '';
      if (pairs.length >= 3) {{
        const n = pairs.length;
        const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
        const my = pairs.reduce((s, p) => s + p[1], 0) / n;
        let num = 0, dx2 = 0, dy2 = 0;
        for (const [a, b] of pairs) {{
          num += (a - mx) * (b - my);
          dx2 += (a - mx) ** 2;
          dy2 += (b - my) ** 2;
        }}
        const r = num / Math.sqrt(dx2 * dy2 || 1);
        corrText = `Pearson r = ${{fmt(r, 3)}} (n=${{n}})`;
      }}
      svg.appendChild(text(M.left + plotW - 10, M.top + 14, corrText, '#cbd5e1', 11, 'end'));

      root.appendChild(svg);
    }}

    // ---- Branch table --------------------------------------------------
    let _sortKey = null, _sortDesc = true;
    function buildBranchTable(schema, branches) {{
      const tbl = document.getElementById('branch-table');
      const cols = [
        {{ key: '_label', name: 'label', type: 'string' }},
        {{ key: '_status', name: 'status', type: 'string' }},
        {{ key: '_round', name: 'round', type: 'numeric' }},
        ...schema.map(v => ({{ key: v.name, name: v.name, type: v.type, range: v.range }})),
      ];
      const rows = branches.map(b => {{
        const r = {{
          _branch: b,
          _label: b.perturbation_label || b.label,
          _status: b.runner_status || b.status,
          _round: `${{b.current_round || 0}}/${{b.total_rounds || 0}}`,
          _round_num: b.current_round || 0,
          _valid: b.valid !== false,
        }};
        for (const v of schema) r[v.name] = (b.outcomes || {{}})[v.name];
        return r;
      }});
      if (_sortKey) {{
        rows.sort((a, b) => {{
          const va = a[_sortKey === '_round' ? '_round_num' : _sortKey];
          const vb = b[_sortKey === '_round' ? '_round_num' : _sortKey];
          if (typeof va === 'number' && typeof vb === 'number') return _sortDesc ? vb - va : va - vb;
          return _sortDesc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
        }});
      }}

      let head = '<thead><tr>';
      for (const c of cols) {{
        const cls = (_sortKey === c.key) ? (_sortDesc ? 'sorted-desc' : 'sorted-asc') : '';
        head += `<th data-key="${{c.key}}" class="${{cls}}">${{c.name}}</th>`;
      }}
      head += '</tr></thead>';

      let body = '<tbody>';
      for (const r of rows) {{
        const trCls = r._valid ? '' : 'invalid';
        body += `<tr class="${{trCls}}">`;
        for (const c of cols) {{
          if (c.key === '_label' || c.key === '_status' || c.key === '_round') {{
            const cls = c.type === 'numeric' ? 'numeric' : 'label';
            body += `<td class="${{cls}}">${{r[c.key] || ''}}</td>`;
          }} else {{
            const v = r[c.key];
            if (typeof v === 'boolean') {{
              body += `<td class="${{v ? 'bool-true' : 'bool-false'}}">${{v ? 'TRUE' : 'false'}}</td>`;
            }} else if (typeof v === 'number') {{
              const range = c.range || [0, 1];
              const t = Math.max(0, Math.min(1, (v - range[0]) / (range[1] - range[0])));
              body += `<td class="numeric value-cell">
                        <div class="v-bg" style="width:${{t*100}}%"></div>
                        <span class="v-text">${{fmt(v, 3)}}</span>
                      </td>`;
            }} else {{
              body += `<td>—</td>`;
            }}
          }}
        }}
        body += '</tr>';
      }}
      body += '</tbody>';
      tbl.innerHTML = head + body;

      // Bind sorting
      tbl.querySelectorAll('th').forEach(th => {{
        th.onclick = () => {{
          const k = th.getAttribute('data-key');
          if (_sortKey === k) _sortDesc = !_sortDesc;
          else {{ _sortKey = k; _sortDesc = true; }}
          buildBranchTable(schema, branches);
        }};
      }});
    }}

    load();
  </script>
</body>
</html>"""
