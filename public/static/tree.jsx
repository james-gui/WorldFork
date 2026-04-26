/* Tree visualization — vertical tidy-tree (Reingold-Tilford-ish).
 *
 * v2 keeps WorldFork's existing vertical layout (root at top, generations
 * stacking downward, recursive leaf-count X spacing) instead of the design
 * spec's horizontal tree — but matches the design's visual language:
 * hairline curved links, mint→indigo→magenta ramp coloring, monospace labels,
 * subtle hover/selection states, animated progress reveal.
 */

// Map a value v in [min,max] to a color on the mint→indigo→magenta ramp.
function rampColor(v, min, max) {
  if (v == null || isNaN(v)) return "oklch(0.85 0.008 240)";
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  const hue = 175 + t * 155;
  const chroma = 0.13 + t * 0.05;
  const lightness = 0.7 - t * 0.1;
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/* ---- layout ----------------------------------------------------------
 * Build a node tree of arbitrary depth:
 *   root → primary[i] → nested descendants (each tagged with `parent`
 *   label and `depth`). A depth-3 entry attaches under whichever
 *   nested node it actually forked from — same mechanic, recursively.
 * Then assign X via tidy-tree (each node's x = centroid of its children;
 * leaves get unique slots), and Y by depth.
 */
function buildTree(scenario, branches, nested, options) {
  const { progress = 1.0, includeNested = true } = options || {};
  const revealCount = Math.min(branches.length, Math.ceil(progress * branches.length));
  const rootBranch = scenario.rootBranch;
  const rootValue = rootBranch?.outcomes ? rootBranch.outcomes[scenario.primary] : null;

  // Build the tree structure (as a JS object graph). When the parent itself
  // ran to horizon (parent_action="continue") and was classified, add a
  // `no perturbation` continuation leaf alongside the perturbed siblings — the
  // null-hypothesis baseline. Visually identical to a normal leaf except for
  // its label, so the eye reads it as a 9th branch ("no change reality").
  const root = {
    id: "root", type: "root", label: "parent",
    fork_round: 0, kind: "trunk",
    children: [],
  };

  if (rootBranch) {
    root.children.push({
      id: "b_no_perturbation", type: "leaf", label: "no perturbation",
      branch: rootBranch, value: rootValue, fork_round: scenario.fork_round,
      isRootContinuation: true,
      children: [],
    });
  }

  // First pass: lay down primaries as leaves.
  const labelToNode = {};
  branches.slice(0, revealCount).forEach((b) => {
    const v = b.outcomes ? b.outcomes[scenario.primary] : null;
    const node = {
      id: `b_${b.label}`, type: "leaf", label: b.label,
      branch: b, value: v, fork_round: scenario.fork_round,
      children: [],
    };
    labelToNode[b.label] = node;
    root.children.push(node);
  });

  // Second pass: attach nested descendants of any depth under whichever
  // node forked them. api.js tags each `nb` with `parent` = the immediate
  // parent's label and `depth` = its depth from root. Sort by depth so we
  // attach depth-2 first (creating fork-shaped parents that depth-3 can
  // then attach onto).
  if (includeNested && nested && nested.length > 0) {
    const byDepth = [...nested].sort((a, b) => (a.depth || 2) - (b.depth || 2));
    for (const nb of byDepth) {
      const parent = labelToNode[nb.parent];
      if (!parent) continue;
      // First child added → promote the parent to a fork node and inject
      // its own continuation leaf so the parent's trajectory is still
      // visible alongside its newly-spawned children.
      if (parent.type === "leaf") {
        parent.type = "fork";
        const pv = parent.branch?.outcomes
          ? parent.branch.outcomes[scenario.primary] : null;
        parent.children.push({
          id: `${parent.id}__cont`, type: "leaf", label: parent.label,
          branch: parent.branch, value: pv,
          fork_round: nb.fork_round, isContinuation: true,
          children: [],
        });
      }
      const nv = nb.outcomes ? nb.outcomes[scenario.primary] : null;
      const child = {
        id: `n_${nb.label}`, type: "leaf", label: nb.label,
        branch: nb, value: nv, fork_round: nb.fork_round,
        nested: true,
        children: [],
      };
      parent.children.push(child);
      labelToNode[nb.label] = child;
    }
  }

  // Tidy layout: x by recursive leaf count, y by depth.
  const NODE_GAP_X = 110;
  const ROW_GAP_Y = 90;
  const TOP_PAD = 60;
  const LEFT_PAD = 60;

  let cursor = 0;
  function leafCount(n) {
    if (!n.children || n.children.length === 0) return 1;
    return n.children.reduce((s, c) => s + leafCount(c), 0);
  }
  function place(n, depth) {
    n._depth = depth;
    n._y = TOP_PAD + depth * ROW_GAP_Y;
    if (!n.children || n.children.length === 0) {
      n._x = LEFT_PAD + cursor * NODE_GAP_X;
      cursor += 1;
    } else {
      for (const c of n.children) place(c, depth + 1);
      const xs = n.children.map(c => c._x);
      n._x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
  }
  place(root, 0);

  // When the tree is just a root (no children rendered yet), the placement
  // above puts it at LEFT_PAD because cursor-based logic treats it as the
  // first leaf. Recenter so the node sits in the middle of the SVG instead
  // of pinned to the left.
  if (root.children.length === 0) {
    root._x = 800 / 2;
  }

  // Collect flat node + link arrays
  const allNodes = [];
  const allLinks = [];
  function walk(n) {
    allNodes.push(n);
    for (const c of n.children || []) {
      allLinks.push({ from: n, to: c, value: c.value, kind: n._depth === 0 ? "trunk" : "branch" });
      walk(c);
    }
  }
  walk(root);

  const maxX = Math.max(...allNodes.map(n => n._x), LEFT_PAD);
  const maxY = Math.max(...allNodes.map(n => n._y), TOP_PAD);
  const width = Math.max(maxX + LEFT_PAD * 2, 800);
  const height = Math.max(maxY + 140, 480);

  return { root, nodes: allNodes, links: allLinks, width, height };
}

function TreeView({ scenario, branches, nested, progress, selected, onSelect, includeNested }) {
  const layout = React.useMemo(
    () => buildTree(scenario, branches, nested, { progress, includeNested }),
    [scenario, branches, nested, progress, includeNested]
  );
  const { nodes, links, width, height } = layout;

  // primary outcome range for color ramp
  const primary = scenario.primary;
  const primarySchema = (scenario.outcome_schema || []).find(o => o.name === primary);
  const [vMin, vMax] = primarySchema?.range || [0, 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      style={{ width: "100%", height: "100%" }}
    >
      <g>
        {/* Links */}
        {links.map((l, i) => {
          const x1 = l.from._x, y1 = l.from._y;
          const x2 = l.to._x, y2 = l.to._y;
          const midY = (y1 + y2) / 2;
          // Cubic bezier for a clean S-curve from parent → child
          const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

          if (l.kind === "trunk" && l.value == null) {
            // Trunk before fork — neutral hairline
            return (
              <path key={i} d={d} fill="none"
                className="node-link active"
                style={{ transition: "all 200ms ease" }} />
            );
          }
          const color = rampColor(l.value, vMin, vMax);
          const isSelected = selected === l.to.id;
          const isDimmed = selected && !isSelected && l.to.type === "leaf";
          return (
            <path key={i} d={d} fill="none"
              stroke={color}
              strokeWidth={isSelected ? 2.4 : 1.4}
              opacity={isDimmed ? 0.25 : 0.9}
              style={{ transition: "all 200ms ease" }} />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          if (n.type === "root") {
            // Click behavior:
            //  - if a no-perturbation continuation leaf exists (post-classify),
            //    redirect there so the user sees the baseline branch's outcomes;
            //  - otherwise (pre-fork or pre-classify) select root itself, which
            //    pages.jsx resolves via scenario.rootLive to the parent's live
            //    round + status info.
            const onRootClick = () => {
              const np = nodes.find(x => x.id === "b_no_perturbation");
              onSelect(np || n);
            };
            const isSelected = selected === n.id;
            return (
              <g key={n.id}
                onClick={onRootClick}
                style={{ cursor: "pointer" }}
              >
                <circle className={`node-circle root ${isSelected ? "selected" : ""}`}
                  cx={n._x} cy={n._y} r={isSelected ? 7.5 : 6}
                  style={{ transition: "all 200ms ease" }} />
                <text className="node-label" x={n._x} y={n._y - 14} textAnchor="middle"
                  style={{ fontWeight: isSelected ? 600 : 400 }}>
                  parent · {scenario.parent_sim_id}
                </text>
              </g>
            );
          }
          if (n.type === "fork") {
            // A leaf-bearing branch that itself becomes a junction for nested.
            // Clickable — selects the underlying branch (same id pattern as a
            // leaf), so the detail pane opens just like clicking a regular branch.
            const color = rampColor(n.value, vMin, vMax);
            const isSelected = selected === n.id;
            return (
              <g key={n.id}
                onClick={() => onSelect(n)}
                style={{ cursor: "pointer" }}
              >
                <circle className={`node-circle fork ${isSelected ? "selected" : ""}`}
                  cx={n._x} cy={n._y} r={isSelected ? 7 : 5.5}
                  style={{ stroke: color, transition: "all 200ms ease" }} />
                <text className="node-label" x={n._x} y={n._y - 14} textAnchor="middle"
                  style={{ fontWeight: isSelected ? 600 : 400 }}>
                  fork @ r{n.fork_round}
                </text>
              </g>
            );
          }
          // Leaf
          const color = rampColor(n.value, vMin, vMax);
          const isSelected = selected === n.id;
          const labelText = n.isContinuation ? `${n.label} (cont.)` : n.label;
          return (
            <g key={n.id}
              onClick={() => onSelect(n)}
              style={{ cursor: "pointer" }}
            >
              <circle
                className={`node-leaf ${isSelected ? "selected" : ""}`}
                cx={n._x} cy={n._y} r={isSelected ? 7.5 : 5.5}
                fill={color}
                style={{ transition: "all 200ms ease" }}
              />
              <text className="node-leaf-label"
                x={n._x} y={n._y + 22}
                textAnchor="middle"
                style={{ fontWeight: isSelected ? 600 : 400, fontSize: 11 }}>
                {labelText.length > 18 ? labelText.slice(0, 17) + "…" : labelText}
              </text>
              {n.value != null && (
                <text x={n._x} y={n._y + 36}
                  textAnchor="middle"
                  className="node-label"
                  style={{ fontFamily: "var(--font-mono)", fill: "var(--fg-3)" }}>
                  {(n.value * 100).toFixed(0)}%
                </text>
              )}
              {n.nested && (
                <text x={n._x} y={n._y + 50}
                  textAnchor="middle"
                  className="node-label"
                  style={{ fontFamily: "var(--font-mono)", fill: "var(--accent-deep)", fontSize: 9 }}>
                  nested · r{n.fork_round}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

window.TreeView = TreeView;
window.rampColor = rampColor;
