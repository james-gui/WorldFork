/* GraphView — hand-rolled force-directed knowledge graph.
 *
 * MiroShark uses d3-force (~50KB). This is a tiny replacement (no deps):
 * Verlet integrator with O(N²) repulsion, spring links, gravity-to-center,
 * damping. For the ~25-node graphs WorldFork bootstraps build, that's
 * fine — runs <30ms per tick and settles in ~150 ticks.
 *
 * Renders as SVG: circles for nodes (color by entity type), lines for
 * edges, hover labels. Polls /api/run/<id>/graph every 8s for updates so
 * the user sees agents adding entities/edges via graph_memory_updater.
 */

const { useState: useStateG, useEffect: useEffectG, useRef: useRefG, useMemo: useMemoG } = React;

// Stable per-type color. Hashes the type name to oklch hue so adding
// new entity types doesn't require palette updates.
function colorForType(type) {
  if (!type) return "oklch(0.7 0.05 240)";
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `oklch(0.72 0.16 ${hue})`;
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

function GraphView({ runId }) {
  const [data, setData] = useStateG(null);
  const [err, setErr] = useStateG(null);
  const [hovered, setHovered] = useStateG(null);
  const [hoveredEdge, setHoveredEdge] = useStateG(null);
  const wrapRef = useRefG(null);
  const [width, setWidth] = useStateG(440);

  // Track container width for responsive sizing
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
    async function fetchOnce() {
      try {
        const body = await fetch(`/api/run/${encodeURIComponent(runId)}/graph`).then(r => r.json());
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
  }, [runId]);

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
        <div className="graph-empty">graph has no entities yet</div>
      </div>
    );
  }

  const types = [...new Set(layout.nodes.map(n => n.type))].sort();

  return (
    <div className="graph-pane" ref={wrapRef}>
      <div className="graph-head">
        <span className="graph-eyebrow">Knowledge graph</span>
        <span className="graph-stats">
          <strong>{layout.nodes.length}</strong> nodes · <strong>{layout.links.length}</strong> edges
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="graph-svg" preserveAspectRatio="xMidYMid meet">
        <g>
          {layout.links.map((l, i) => {
            const a = layout.nodes[l.s], b = layout.nodes[l.t];
            const isHov = hoveredEdge === i || hovered === l.s || hovered === l.t;
            return (
              <line key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHov ? "var(--accent)" : "var(--rule)"}
                strokeWidth={isHov ? 1.6 : 0.8}
                opacity={isHov ? 0.95 : 0.5}
                onMouseEnter={() => setHoveredEdge(i)}
                onMouseLeave={() => setHoveredEdge(null)}
                style={{ cursor: "pointer", transition: "opacity 150ms" }}
              />
            );
          })}
          {layout.nodes.map((n, i) => {
            const c = colorForType(n.type);
            const isHov = hovered === i;
            return (
              <g key={n.id}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={n.x} cy={n.y} r={isHov ? 5.5 : 4}
                  fill={c}
                  style={{ transition: "r 150ms" }} />
                {isHov && (
                  <text x={n.x} y={n.y - 9} textAnchor="middle"
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
          <span className="graph-type-badge" style={{ background: colorForType(layout.nodes[hovered].type) }}>
            {layout.nodes[hovered].type}
          </span>
          {layout.nodes[hovered].summary && (
            <div className="graph-summary">{layout.nodes[hovered].summary}</div>
          )}
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
          {layout.links[hoveredEdge].fact && (
            <div className="graph-summary">{layout.links[hoveredEdge].fact}</div>
          )}
        </div>
      )}
      <div className="graph-legend">
        {types.slice(0, 6).map(t => (
          <span key={t} className="graph-legend-item">
            <span className="dot" style={{ background: colorForType(t) }}></span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

window.GraphView = GraphView;
