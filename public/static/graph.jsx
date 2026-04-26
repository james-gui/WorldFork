/* GraphView — agent interaction network for a branch.
 *
 * MiroShark uses d3-force (~50KB) for this. Replaced with a tiny
 * dependency-free Verlet integrator: O(N²) repulsion, spring links
 * (length scales by edge weight), gravity-to-center, damping. For the
 * ~20-node interaction graphs typical of a branch this settles in
 * ~150 ticks (<40ms total).
 *
 * Backend: /api/run/<run_id>/graph?sim=<sim_id> proxies MiroShark's
 * /api/simulation/<id>/interaction-network. Polled every 8s so the
 * graph evolves while the branch runs (MiroShark recomputes from
 * actions.jsonl until it caches network.json on completion).
 */

const { useState: useStateG, useEffect: useEffectG, useRef: useRefG, useMemo: useMemoG } = React;

// Color by stance ("supportive" / "neutral" / "skeptical" / "opposed") with
// a fallback per-platform palette. Mirrors MiroShark's node coloring.
const STANCE_COLOR = {
  supportive: "oklch(0.78 0.16 145)",   // green
  positive:   "oklch(0.78 0.16 145)",
  neutral:    "oklch(0.75 0.04 240)",   // muted slate
  skeptical:  "oklch(0.78 0.14 60)",    // amber
  opposed:    "oklch(0.7 0.18 25)",     // red
  negative:   "oklch(0.7 0.18 25)",
};

function colorForNode(n) {
  if (n.stance && STANCE_COLOR[n.stance.toLowerCase()]) return STANCE_COLOR[n.stance.toLowerCase()];
  // Fallback: hash primary platform / type name to a stable hue
  const t = n.type || n.primary_platform || "agent";
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return `oklch(0.72 0.14 ${h % 360})`;
}

function layoutGraph(nodes, edges, width, height) {
  // Each node gets x, y, vx, vy. Use deterministic seed per node id so
  // a node's position is stable across re-renders (key insight for
  // polling: when a new node arrives, existing ones don't jump around).
  const N = nodes.length;
  const positioned = nodes.map((n, i) => {
    let h = 0;
    for (let k = 0; k < (n.id || "").length; k++) h = (h * 31 + n.id.charCodeAt(k)) >>> 0;
    const angle = (h % 360) * Math.PI / 180;
    const r = 80 + (h % 60);
    return {
      ...n,
      x: width/2 + Math.cos(angle) * r,
      y: height/2 + Math.sin(angle) * r,
      vx: 0, vy: 0,
    };
  });
  const idIndex = Object.fromEntries(positioned.map((n, i) => [n.id, i]));
  const links = edges
    .map(e => ({ s: idIndex[e.source], t: idIndex[e.target], type: e.type, fact: e.fact }))
    .filter(l => l.s !== undefined && l.t !== undefined);

  const REPULSE = 1500;
  const LINK_DIST = 80;
  const LINK_K = 0.04;
  const CENTER_K = 0.005;
  const DAMP = 0.85;
  const TICKS = 220;

  for (let t = 0; t < TICKS; t++) {
    // Repulsive
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = positioned[i], b = positioned[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx*dx + dy*dy + 1;
        const f = REPULSE / d2;
        const fx = (dx / Math.sqrt(d2)) * f;
        const fy = (dy / Math.sqrt(d2)) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
    // Springs
    for (const l of links) {
      const a = positioned[l.s], b = positioned[l.t];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx*dx + dy*dy) + 0.01;
      const f = (d - LINK_DIST) * LINK_K;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
    // Gravity to center
    for (const n of positioned) {
      n.vx += (width/2 - n.x) * CENTER_K;
      n.vy += (height/2 - n.y) * CENTER_K;
    }
    // Step + damping
    for (const n of positioned) {
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;
    }
  }

  return { nodes: positioned, links };
}

function GraphView({ runId, simId }) {
  const [data, setData] = useStateG(null);
  const [err, setErr] = useStateG(null);
  const [hovered, setHovered] = useStateG(null);
  const [hoveredEdge, setHoveredEdge] = useStateG(null);
  const wrapRef = useRefG(null);
  const [width, setWidth] = useStateG(440);

  useEffectG(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.max(280, Math.floor(e.contentRect.width)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffectG(() => {
    if (!runId) return;
    let cancelled = false;
    // In static mode, graph data was pre-fetched into /data/graph/<run>/<sim>.json
    // (the no-sim variant isn't snapshotted — every static graph fetch must
    // include a sim_id, which the tree always provides for selected leaves).
    const url = window.WF_STATIC
      ? (simId
          ? `/data/graph/${encodeURIComponent(runId)}/${encodeURIComponent(simId)}.json`
          : null)
      : (simId
          ? `/api/run/${encodeURIComponent(runId)}/graph?sim=${encodeURIComponent(simId)}`
          : `/api/run/${encodeURIComponent(runId)}/graph`);
    if (!url) return;
    async function fetchOnce() {
      try {
        const body = await fetch(url).then(r => r.json());
        if (cancelled) return;
        if (body.error) setErr(body.error);
        else { setErr(null); setData(body.graph); }
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    }
    fetchOnce();
    const t = setInterval(fetchOnce, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [runId, simId]);

  const height = 320;
  const layout = useMemoG(() => {
    if (!data || !data.nodes || !data.nodes.length) return null;
    return layoutGraph(data.nodes, data.edges || [], width, height);
  }, [data, width]);

  if (err) {
    return (
      <div className="graph-pane">
        <div className="graph-empty">Graph: {err}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="graph-pane">
        <div className="graph-empty">loading graph…</div>
      </div>
    );
  }
  if (!data.nodes || !data.nodes.length) {
    return (
      <div className="graph-pane">
        <div className="graph-empty">no agent interactions yet</div>
      </div>
    );
  }

  // Legend: prefer stance values present, fall back to platform/type
  const legendKeys = (() => {
    const stances = [...new Set(layout.nodes.map(n => n.stance).filter(Boolean))];
    if (stances.length) return stances.map(s => ({ label: s, color: STANCE_COLOR[s.toLowerCase()] || colorForNode({stance: s}) }));
    const types = [...new Set(layout.nodes.map(n => n.type))].sort();
    return types.slice(0, 6).map(t => ({ label: t, color: colorForNode({type: t}) }));
  })();

  // Node radius scales with total_degree (popularity in the network).
  // Edge thickness scales with weight. Caps are tuned for readability.
  const maxDegree = Math.max(1, ...layout.nodes.map(n => n.total_degree || 0));
  const maxWeight = Math.max(1, ...layout.links.map(l => l.weight || 1));
  const radiusFor = (n, hov) => {
    const base = 3.5 + 4 * Math.sqrt((n.total_degree || 0) / maxDegree);
    return hov ? base + 1.5 : base;
  };

  return (
    <div className="graph-pane" ref={wrapRef}>
      <div className="graph-head">
        <span className="graph-eyebrow">Agent interaction network</span>
        <span className="graph-stats">
          <strong>{layout.nodes.length}</strong> agents · <strong>{layout.links.length}</strong> interactions
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg" preserveAspectRatio="xMidYMid meet">
        <g>
          {layout.links.map((l, i) => {
            const a = layout.nodes[l.s], b = layout.nodes[l.t];
            const isHov = hoveredEdge === i || hovered === l.s || hovered === l.t;
            const w = 0.6 + 1.8 * ((l.weight || 1) / maxWeight);
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHov ? "var(--accent)" : "var(--rule)"}
                strokeWidth={isHov ? w + 0.8 : w}
                opacity={isHov ? 0.95 : 0.55}
                onMouseEnter={() => setHoveredEdge(i)}
                onMouseLeave={() => setHoveredEdge(null)}
                style={{ cursor: "pointer", transition: "opacity 150ms" }}
              />
            );
          })}
          {layout.nodes.map((n, i) => {
            const c = colorForNode(n);
            const isHov = hovered === i;
            return (
              <g key={n.id}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={n.x} cy={n.y} r={radiusFor(n, isHov)}
                  fill={c}
                  style={{ transition: "r 150ms" }} />
                {isHov && (
                  <text x={n.x} y={n.y - radiusFor(n, isHov) - 4} textAnchor="middle"
                    style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--fg)" }}>
                    {n.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {hovered != null && layout.nodes[hovered] && (
        <div className="graph-tooltip">
          <strong>{layout.nodes[hovered].name}</strong>
          <div style={{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
            <span className="graph-type-badge" style={{ background: colorForNode(layout.nodes[hovered]) }}>
              {layout.nodes[hovered].stance || layout.nodes[hovered].type}
            </span>
            {layout.nodes[hovered].rank && (
              <span style={{fontFamily:"var(--font-mono)", fontSize:10, color:"var(--fg-3)"}}>
                rank #{layout.nodes[hovered].rank}
              </span>
            )}
          </div>
          <div className="graph-summary">
            in {layout.nodes[hovered].in_degree || 0} ·
            out {layout.nodes[hovered].out_degree || 0} ·
            influence {layout.nodes[hovered].influence_score || 0}
          </div>
        </div>
      )}
      {hoveredEdge != null && layout.links[hoveredEdge] && (
        <div className="graph-tooltip edge">
          <span className="edge-type">{layout.links[hoveredEdge].type}</span>
          <span className="edge-pair">
            {layout.nodes[layout.links[hoveredEdge].s].name}
            {" → "}
            {layout.nodes[layout.links[hoveredEdge].t].name}
          </span>
          <div className="graph-summary">
            weight {layout.links[hoveredEdge].weight}
            {layout.links[hoveredEdge].is_cross_platform ? " · cross-platform" : ""}
          </div>
        </div>
      )}
      <div className="graph-legend">
        {legendKeys.map(k => (
          <span key={k.label} className="graph-legend-item">
            <span className="dot" style={{ background: k.color }}></span>
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

window.GraphView = GraphView;
