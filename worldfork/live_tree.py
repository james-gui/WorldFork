"""Live tidy-tree renderer (v0.5).

Renders the lineage tree of an in-flight WorldFork ensemble as an
animated SVG. Layout is recomputed every poll with a Reingold-Tilford-style
tidy tree; sibling slots are sized in proportion to leaf count so a
heavily-forked branch grows sideways while a single-line branch stays narrow.

Why client-side:
    Server-side SVG rendering would replace innerHTML on every poll, killing
    CSS transitions. Client-side rendering lets each <g class="node"
    data-sim-id="..."> persist across polls — only its `transform: translate`
    changes, so CSS animates the slide.

The page polls /api/run/<run_id>/lineage every 2 sec and re-renders.
"""

from __future__ import annotations


def render_live_tree_page(run_id: str, title: str) -> str:
    """HTML page for the live tree. Embeds the entire JS renderer."""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WorldFork — {title}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #0b1020; color: #e5e7eb;
           font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }}
    header {{ background: #111827; border-bottom: 1px solid #1f2937;
              padding: 0.9em 1.5em; display: flex; justify-content: space-between;
              align-items: center; }}
    header h1 {{ margin: 0; font-size: 1.1em; font-weight: 600; }}
    header .meta {{ color: #9ca3af; font-size: 0.85em; margin-top: 0.15em; }}
    header a.back {{ color: #818cf8; text-decoration: none; font-size: 0.85em; }}
    header a.back:hover {{ text-decoration: underline; }}
    header a.analysis-btn {{ background: #4f46e5; color: white; padding: 0.5em 1em;
                              border-radius: 6px; text-decoration: none; font-size: 0.85em;
                              font-weight: 600; margin-right: 0.8em; display: none;
                              transition: background 200ms; }}
    header a.analysis-btn:hover {{ background: #4338ca; }}
    header a.analysis-btn.ready {{ display: inline-block; }}
    #info {{ background: #1f2937; padding: 0.6em 1.5em; font-size: 0.85em;
              border-bottom: 1px solid #374151; display: flex; gap: 1.5em; }}
    #info .pill {{ background: #0b1020; padding: 0.2em 0.6em; border-radius: 999px;
                    border: 1px solid #374151; }}
    #info .pulse {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                     background: #22c55e; margin-right: 0.4em;
                     animation: pulse 1.5s ease-in-out infinite; }}
    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.3; }} }}
    #layout {{ display: flex; height: calc(100vh - 120px); }}
    #stage {{ flex: 1; overflow: auto; }}
    #side {{ width: 360px; min-width: 360px; border-left: 1px solid #1f2937;
             background: #0f172a; overflow-y: auto; padding: 1em;
             font-size: 0.85em; }}
    #side h2 {{ font-size: 0.9em; margin: 0 0 0.5em 0; color: #e5e7eb;
                 text-transform: uppercase; letter-spacing: 0.05em;
                 font-weight: 600; }}
    #side .empty {{ color: #6b7280; font-style: italic; }}
    .dist-block {{ margin-bottom: 1.5em; padding: 0.8em;
                    background: #111827; border: 1px solid #1f2937; border-radius: 6px; }}
    .dist-block h3 {{ margin: 0 0 0.3em 0; font-size: 0.85em; color: #cbd5e1;
                       font-weight: 600; }}
    .dist-block .desc {{ font-size: 0.75em; color: #94a3b8; margin-bottom: 0.6em;
                          line-height: 1.4; }}
    .dist-stats {{ display: flex; gap: 0.8em; font-size: 0.75em; color: #cbd5e1;
                    margin-top: 0.4em; flex-wrap: wrap; }}
    .dist-stats span {{ background: #0b1020; padding: 0.15em 0.4em; border-radius: 3px;
                         border: 1px solid #1f2937; }}
    .dist-stats strong {{ color: #f3f4f6; }}
    svg {{ display: block; }}
    /* Each tree node persists across polls — CSS transition animates the slide. */
    .node {{ transition: transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1); }}
    .node-circle {{ transition: fill 300ms ease, stroke 300ms ease, r 300ms ease; }}
    .node-label {{ font-family: ui-monospace, "SF Mono", monospace; font-size: 11px;
                    fill: #cbd5e1; pointer-events: none;
                    transition: fill 300ms ease; }}
    .node-round {{ font-family: ui-monospace, monospace; font-size: 9px;
                    fill: #6b7280; pointer-events: none; }}
    /* Edges from parent → child. Use stroke-dasharray for "this child is alive but waiting" */
    .edge {{ fill: none; stroke: #4b5563; stroke-width: 1.5; pointer-events: none;
             transition: d 600ms cubic-bezier(0.22, 0.61, 0.36, 1),
                         stroke 300ms ease; }}
    /* Status colors */
    .status-running {{ fill: #3b82f6; stroke: #93c5fd; }}
    .status-completed {{ fill: #22c55e; stroke: #86efac; }}
    .status-ready {{ fill: #6b7280; stroke: #9ca3af; }}
    .status-failed {{ fill: #ef4444; stroke: #fca5a5; }}
    .status-stopped {{ fill: #f59e0b; stroke: #fcd34d; }}
    /* Progress bar inside each node */
    .progress-bg {{ fill: #1f2937; }}
    .progress-fill {{ fill: #3b82f6;
                       transition: width 800ms cubic-bezier(0.22, 0.61, 0.36, 1); }}
    .progress-fill.done {{ fill: #22c55e; }}
    /* Tooltip */
    #tooltip {{ position: fixed; background: #111827; border: 1px solid #4b5563;
                padding: 0.5em 0.7em; border-radius: 4px; font-size: 0.8em;
                pointer-events: none; z-index: 100; display: none; max-width: 300px;
                font-family: ui-monospace, monospace; }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>WorldFork live tree</h1>
      <div class="meta" id="meta">{title}</div>
    </div>
    <div>
      <a class="analysis-btn" id="analysis-btn" href="/run/{run_id}/analysis">📊 Open data analysis →</a>
      <a class="back" href="/">← back</a>
    </div>
  </header>
  <div id="info">
    <span class="pill"><span class="pulse"></span><span id="phase">connecting…</span></span>
    <span class="pill" id="counts">—</span>
    <span class="pill" id="forks">—</span>
  </div>
  <div id="layout">
    <div id="stage">
      <svg id="tree" width="100%" height="100%"></svg>
    </div>
    <div id="side">
      <h2>outcome distributions</h2>
      <div id="distributions"><div class="empty">awaiting classifier output…</div></div>
    </div>
  </div>
  <div id="tooltip"></div>

  <script>
    const RUN_ID = {run_id!r};
    const POLL_INTERVAL_MS = 2000;
    const NODE_RADIUS = 9;
    const NODE_WIDTH = 110;        // horizontal slot width per leaf
    const NODE_GAP_Y = 60;         // vertical distance per fork-depth level
    const TOP_PAD = 60;
    const LEFT_PAD = 40;
    const PROGRESS_BAR_W = 80;
    const PROGRESS_BAR_H = 6;

    const svg = document.getElementById('tree');
    const tooltip = document.getElementById('tooltip');

    // Persistent map: sim_id → DOM <g class="node">
    const nodeGroups = new Map();
    // Persistent map: child_sim_id → DOM <path class="edge">
    const edgePaths = new Map();

    async function poll() {{
      try {{
        const r = await fetch(`/api/run/${{RUN_ID}}/lineage`);
        if (!r.ok) {{ setStatus('error', 'lineage HTTP ' + r.status); return; }}
        const data = await r.json();
        if (data.error) {{ setStatus('error', data.error); return; }}
        renderTree(data);
      }} catch (e) {{
        setStatus('error', e.message);
      }} finally {{
        // Keep polling unless run is terminal AND we've shown final state once
        if (!window.__terminal_shown) {{
          setTimeout(poll, POLL_INTERVAL_MS);
        }}
      }}
    }}

    function setStatus(phase, extra) {{
      document.getElementById('phase').textContent = phase + (extra ? ' — ' + extra : '');
    }}

    function renderTree(data) {{
      if (!data.tree) {{ setStatus(data.phase || 'waiting', 'no tree yet'); return; }}

      // 1) Tidy-tree layout: assign x,y to every node
      const layout = layoutTree(data.tree);

      // 2) Compute canvas size to fit tree + add overflow scrolling
      const allNodes = flattenNodes(data.tree);
      const maxX = Math.max(...allNodes.map(n => n._x), 0);
      const maxY = Math.max(...allNodes.map(n => n._y), 0);
      const w = Math.max(maxX + LEFT_PAD * 2 + NODE_WIDTH, 600);
      const h = Math.max(maxY + TOP_PAD * 2, 400);
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', `0 0 ${{w}} ${{h}}`);

      // 3) Update header info
      const total = allNodes.length;
      const running = allNodes.filter(n => n.runner_status === 'running').length;
      const completed = allNodes.filter(n => n.runner_status === 'completed').length;
      const forks = allNodes.filter(n => n.children && n.children.length > 0).length;
      setStatus(data.phase || 'live', `${{total}} sim(s)`);
      document.getElementById('counts').textContent =
        `${{running}} running · ${{completed}} done · ${{total - running - completed}} pending`;
      document.getElementById('forks').textContent =
        `${{forks}} fork point(s)`;

      // 4) Render edges first (so they sit behind nodes)
      const liveEdgeKeys = new Set();
      walkTree(data.tree, parent => {{
        for (const child of (parent.children || [])) {{
          const key = `${{parent.sim_id}}→${{child.sim_id}}`;
          liveEdgeKeys.add(key);
          let path = edgePaths.get(key);
          if (!path) {{
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('edge');
            svg.appendChild(path);
            edgePaths.set(key, path);
          }}
          // Curve from parent's bottom to child's top — a vertical S-curve.
          const x1 = parent._x + NODE_WIDTH / 2;
          const y1 = parent._y + NODE_RADIUS;
          const x2 = child._x + NODE_WIDTH / 2;
          const y2 = child._y - NODE_RADIUS;
          const midY = (y1 + y2) / 2;
          path.setAttribute('d',
            `M ${{x1}} ${{y1}} C ${{x1}} ${{midY}}, ${{x2}} ${{midY}}, ${{x2}} ${{y2}}`);
        }}
      }});
      // Cull dead edges
      for (const [key, path] of edgePaths.entries()) {{
        if (!liveEdgeKeys.has(key)) {{
          path.remove();
          edgePaths.delete(key);
        }}
      }}

      // 5) Render/update nodes
      const liveNodeKeys = new Set();
      walkTree(data.tree, n => {{
        liveNodeKeys.add(n.sim_id);
        let g = nodeGroups.get(n.sim_id);
        if (!g) {{
          g = createNode(n);
          svg.appendChild(g);
          nodeGroups.set(n.sim_id, g);
        }}
        updateNode(g, n);
      }});
      // Cull dead nodes
      for (const [sid, g] of nodeGroups.entries()) {{
        if (!liveNodeKeys.has(sid)) {{
          g.remove();
          nodeGroups.delete(sid);
        }}
      }}

      // 6) Draw outcome distributions in the side panel + recolor leaves by
      //    the headline outcome (first numeric variable in the schema).
      renderDistributions(data);

      // 7) Show the "Open data analysis" button as soon as the manifest
      //    is on disk (classifier has output something).
      if (data.manifest_present) {{
        document.getElementById('analysis-btn').classList.add('ready');
      }}

      // 8) If terminal, mark so we stop polling
      if (data.phase === 'complete' || data.phase === 'failed') {{
        window.__terminal_shown = true;
        setStatus(data.phase);
      }}
    }}

    function renderDistributions(data) {{
      const panel = document.getElementById('distributions');
      const dists = data.distributions || {{}};
      const schema = data.outcome_schema || [];
      const numericVars = schema.filter(v =>
        ['float', 'int', 'number'].includes((v.type || '').toLowerCase()) && dists[v.name]);

      if (numericVars.length === 0) {{
        if (data.manifest_present) {{
          panel.innerHTML = '<div class="empty">no numeric outcomes in schema</div>';
        }}
        // else keep "awaiting classifier output…"
        return;
      }}

      // Heatmap-color leaves by the first numeric outcome (the "headline" var)
      const headline = numericVars[0];
      const headlineDist = dists[headline.name];
      const range = headline.range || [headlineDist.min, headlineDist.max];
      colorLeavesByOutcome(headline.name, range);

      // Render one block per numeric outcome
      panel.innerHTML = numericVars.map(v => renderDistBlock(v, dists[v.name])).join('');
    }}

    function renderDistBlock(varDef, d) {{
      const range = varDef.range || [d.min, d.max];
      const [lo, hi] = range;
      const width = 320, height = 90;
      const margin = {{ left: 8, right: 8, top: 8, bottom: 22 }};
      const plotW = width - margin.left - margin.right;
      const plotH = height - margin.top - margin.bottom;

      // Build histogram: 12 bins across the value range
      const nBins = 12;
      const binW = (hi - lo) / nBins;
      const bins = new Array(nBins).fill(0);
      for (const v of d.values) {{
        const idx = Math.min(nBins - 1, Math.max(0, Math.floor((v - lo) / binW)));
        bins[idx]++;
      }}
      const maxBin = Math.max(...bins, 1);

      // Render bars
      let bars = '';
      for (let i = 0; i < nBins; i++) {{
        const h = (bins[i] / maxBin) * plotH;
        const x = margin.left + i * (plotW / nBins) + 1;
        const y = margin.top + plotH - h;
        const w = plotW / nBins - 2;
        // Color: gradient from green→amber→red across range
        const t = (i + 0.5) / nBins;
        const color = colorForT(t);
        bars += `<rect x="${{x}}" y="${{y}}" width="${{w}}" height="${{h}}" fill="${{color}}"/>`;
      }}

      // Median + IQR markers
      const xOf = (v) => margin.left + ((v - lo) / (hi - lo)) * plotW;
      const medianX = xOf(d.median);
      const q25X = xOf(d.q25);
      const q75X = xOf(d.q75);
      const iqr = `<rect x="${{q25X}}" y="${{margin.top + plotH + 4}}" width="${{q75X - q25X}}"
                          height="6" fill="#3b82f6" opacity="0.4"/>`;
      const med = `<line x1="${{medianX}}" y1="${{margin.top}}" x2="${{medianX}}" y2="${{margin.top + plotH + 10}}"
                          stroke="#fbbf24" stroke-width="2"/>`;

      // Axis labels
      const axis = `
        <text x="${{margin.left}}" y="${{height - 4}}" font-size="9" fill="#6b7280">${{lo}}</text>
        <text x="${{margin.left + plotW}}" y="${{height - 4}}" font-size="9" fill="#6b7280" text-anchor="end">${{hi}}</text>
      `;

      const desc = (varDef.description || '').slice(0, 200);
      return `
        <div class="dist-block">
          <h3>${{varDef.name}}</h3>
          <div class="desc">${{desc}}${{varDef.description && varDef.description.length > 200 ? '…' : ''}}</div>
          <svg width="${{width}}" height="${{height}}" style="display:block; max-width:100%;">
            ${{bars}}
            ${{iqr}}
            ${{med}}
            ${{axis}}
          </svg>
          <div class="dist-stats">
            <span><strong>n</strong> ${{d.n}}</span>
            <span>median <strong>${{fmt(d.median)}}</strong></span>
            <span>mean <strong>${{fmt(d.mean)}}</strong></span>
            <span>IQR [<strong>${{fmt(d.q25)}}</strong>, <strong>${{fmt(d.q75)}}</strong>]</span>
            <span>range [<strong>${{fmt(d.min)}}</strong>, <strong>${{fmt(d.max)}}</strong>]</span>
          </div>
        </div>
      `;
    }}

    function fmt(x) {{
      if (x == null) return '—';
      if (Math.abs(x) >= 100) return x.toFixed(0);
      if (Math.abs(x) >= 10) return x.toFixed(1);
      return x.toFixed(2);
    }}

    function colorForT(t) {{
      // green (low) → amber (mid) → red (high)
      // t in [0, 1]
      if (t < 0.5) {{
        const k = t / 0.5; // 0..1
        const r = Math.round(34 + k * (251 - 34));      // 22→fb (34→251)
        const g = Math.round(197 + k * (191 - 197));    // c5→bf
        const b = Math.round(94 + k * (36 - 94));       // 5e→24
        return `rgb(${{r}}, ${{g}}, ${{b}})`;
      }} else {{
        const k = (t - 0.5) / 0.5;
        const r = Math.round(251 + k * (239 - 251));    // fb→ef
        const g = Math.round(191 + k * (68 - 191));     // bf→44
        const b = Math.round(36 + k * (68 - 36));       // 24→44
        return `rgb(${{r}}, ${{g}}, ${{b}})`;
      }}
    }}

    function colorLeavesByOutcome(varName, range) {{
      const [lo, hi] = range;
      for (const [sid, g] of nodeGroups.entries()) {{
        const payload = JSON.parse(g.getAttribute('data-payload') || '{{}}');
        const isLeaf = !payload.children || payload.children.length === 0;
        if (!isLeaf) continue;
        const outcomes = payload.outcomes || {{}};
        const v = outcomes[varName];
        const circle = g.querySelector('.node-circle');
        if (typeof v === 'number') {{
          const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
          circle.setAttribute('fill', colorForT(t));
          circle.setAttribute('stroke', '#fff');
          circle.setAttribute('r', NODE_RADIUS + 2);
        }}
      }}
    }}

    function createNode(n) {{
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('node');
      g.setAttribute('data-sim-id', n.sim_id);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.classList.add('node-circle');
      circle.setAttribute('cx', NODE_WIDTH / 2);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', NODE_RADIUS);
      circle.setAttribute('stroke-width', 2);
      g.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.classList.add('node-label');
      label.setAttribute('x', NODE_WIDTH / 2);
      label.setAttribute('y', NODE_RADIUS + 14);
      label.setAttribute('text-anchor', 'middle');
      g.appendChild(label);

      const round = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      round.classList.add('node-round');
      round.setAttribute('x', NODE_WIDTH / 2);
      round.setAttribute('y', NODE_RADIUS + 26);
      round.setAttribute('text-anchor', 'middle');
      g.appendChild(round);

      // Progress bar background
      const pbBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pbBg.classList.add('progress-bg');
      pbBg.setAttribute('x', (NODE_WIDTH - PROGRESS_BAR_W) / 2);
      pbBg.setAttribute('y', NODE_RADIUS + 30);
      pbBg.setAttribute('width', PROGRESS_BAR_W);
      pbBg.setAttribute('height', PROGRESS_BAR_H);
      pbBg.setAttribute('rx', 2);
      g.appendChild(pbBg);

      const pbFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pbFill.classList.add('progress-fill');
      pbFill.setAttribute('x', (NODE_WIDTH - PROGRESS_BAR_W) / 2);
      pbFill.setAttribute('y', NODE_RADIUS + 30);
      pbFill.setAttribute('width', 0);
      pbFill.setAttribute('height', PROGRESS_BAR_H);
      pbFill.setAttribute('rx', 2);
      g.appendChild(pbFill);

      // Hover for tooltip
      g.addEventListener('mouseenter', e => {{
        const _n = JSON.parse(g.getAttribute('data-payload') || '{{}}');
        showTip(e, _n);
      }});
      g.addEventListener('mousemove', e => positionTip(e));
      g.addEventListener('mouseleave', () => hideTip());

      return g;
    }}

    function updateNode(g, n) {{
      g.setAttribute('transform', `translate(${{n._x}}, ${{n._y}})`);
      g.setAttribute('data-payload', JSON.stringify(n));

      const circle = g.querySelector('.node-circle');
      circle.classList.remove('status-running', 'status-completed', 'status-ready',
                               'status-failed', 'status-stopped');
      const status = n.runner_status || n.status || 'ready';
      circle.classList.add(`status-${{status}}`);
      // Bigger circle for fork points
      const isFork = n.children && n.children.length > 0;
      circle.setAttribute('r', isFork ? NODE_RADIUS + 2 : NODE_RADIUS);

      const label = g.querySelector('.node-label');
      const lab = (n.perturbation_label || n.label || 'root');
      label.textContent = lab.length > 14 ? lab.slice(0, 13) + '…' : lab;

      const round = g.querySelector('.node-round');
      const cur = n.current_round || 0;
      const tot = n.total_rounds || 0;
      round.textContent = tot ? `${{cur}}/${{tot}}` : '';

      const pbFill = g.querySelector('.progress-fill');
      const frac = tot ? Math.min(1, cur / tot) : 0;
      pbFill.setAttribute('width', PROGRESS_BAR_W * frac);
      if (status === 'completed') pbFill.classList.add('done');
      else pbFill.classList.remove('done');
    }}

    function showTip(e, n) {{
      const lines = [
        `<strong>${{n.perturbation_label || n.label || 'root'}}</strong>`,
        `sim_id: ${{n.sim_id}}`,
        `status: ${{n.runner_status || n.status || '?'}}`,
        `round: ${{n.current_round || 0}} / ${{n.total_rounds || '?'}}`,
      ];
      if (n.fork_round != null) lines.push(`forked from parent round: ${{n.fork_round}}`);
      tooltip.innerHTML = lines.join('<br>');
      tooltip.style.display = 'block';
      positionTip(e);
    }}
    function positionTip(e) {{
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top  = (e.clientY + 12) + 'px';
    }}
    function hideTip() {{ tooltip.style.display = 'none'; }}

    // -----------------------------------------------------------------
    // Tidy-tree layout (Reingold-Tilford-ish, simplified)
    // -----------------------------------------------------------------
    function leafCount(n) {{
      if (!n.children || n.children.length === 0) return 1;
      return n.children.reduce((s, c) => s + leafCount(c), 0);
    }}
    function depth(n, d=0) {{
      if (!n.children || n.children.length === 0) return d;
      return Math.max(...n.children.map(c => depth(c, d + 1)));
    }}

    function layoutTree(root) {{
      // Assign x by recursive sub-tree leaf count; y by fork-depth.
      let cursor = LEFT_PAD;
      function place(n, d) {{
        const lc = leafCount(n);
        if (!n.children || n.children.length === 0) {{
          n._x = cursor;
          cursor += NODE_WIDTH;
        }} else {{
          for (const c of n.children) place(c, d + 1);
          // parent x = midpoint of children
          const xs = n.children.map(c => c._x);
          n._x = (Math.min(...xs) + Math.max(...xs)) / 2;
        }}
        n._y = TOP_PAD + d * NODE_GAP_Y;
      }}
      place(root, 0);
      return root;
    }}

    function walkTree(n, fn) {{
      fn(n);
      for (const c of (n.children || [])) walkTree(c, fn);
    }}
    function flattenNodes(n) {{
      const out = [];
      walkTree(n, x => out.push(x));
      return out;
    }}

    // Boot
    poll();
  </script>
</body>
</html>"""
