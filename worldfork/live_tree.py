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
    #info {{ background: #1f2937; padding: 0.6em 1.5em; font-size: 0.85em;
              border-bottom: 1px solid #374151; display: flex; gap: 1.5em; }}
    #info .pill {{ background: #0b1020; padding: 0.2em 0.6em; border-radius: 999px;
                    border: 1px solid #374151; }}
    #info .pulse {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                     background: #22c55e; margin-right: 0.4em;
                     animation: pulse 1.5s ease-in-out infinite; }}
    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.3; }} }}
    #stage {{ width: 100%; height: calc(100vh - 120px); overflow: auto; }}
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
    <a class="back" href="/">← back</a>
  </header>
  <div id="info">
    <span class="pill"><span class="pulse"></span><span id="phase">connecting…</span></span>
    <span class="pill" id="counts">—</span>
    <span class="pill" id="forks">—</span>
  </div>
  <div id="stage">
    <svg id="tree" width="100%" height="100%"></svg>
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

      // 6) If terminal, mark so we stop polling
      if (data.phase === 'complete' || data.phase === 'failed') {{
        window.__terminal_shown = true;
        setStatus(data.phase);
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
