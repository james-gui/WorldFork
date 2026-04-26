/* Analysis page — live data version.
 *
 * Renders strictly from the adapted scenario object (which mirrors the v1
 * lineage payload + manifest distributions). Take-aways are derived from
 * the data itself instead of being scenario-specific hardcoded copy.
 */

const { useState: useStateA, useMemo: useMemoA } = React;

function AnalysisPage({ scenario, loading, err, onBack, onSim }) {
  const [sortBy, setSortBy] = useStateA("primary");
  const [sortDir, setSortDir] = useStateA("desc");

  React.useEffect(() => { setSortBy("primary"); setSortDir("desc"); }, [scenario?.id]);

  if (err) {
    return (
      <div className="analysis">
        <div className="empty-detail" style={{padding: 60}}>
          <div className="ic">!</div>
          <div style={{color: "var(--bad)"}}>Failed to load: {err}</div>
        </div>
      </div>
    );
  }
  if (loading || !scenario) {
    return (
      <div className="analysis">
        <div className="empty-detail" style={{padding: 60}}>
          <div className="ic">…</div>
          <div>Loading run…</div>
        </div>
      </div>
    );
  }
  if (!scenario.manifest_present) {
    return (
      <div className="analysis">
        <div className="analysis-head">
          <div>
            <div className="eyebrow">Run analysis · {scenario.name}</div>
            <h2>Awaiting <em>classifier</em></h2>
            <p>The ensemble is still running ({scenario.phase}). Outcomes are
              computed once the classifier sweeps each branch — this page
              auto-fills the moment that happens.</p>
          </div>
          <div className="analysis-head-meta">
            <div>parent · {scenario.parent_sim_id}</div>
            <div>fork @ r{scenario.fork_round} · horizon r{scenario.horizon_rounds}</div>
            <div>{scenario.branches.length} branches so far</div>
          </div>
        </div>
        <div style={{display:"flex", justifyContent:"space-between", paddingTop: 32, borderTop: "1px solid var(--rule)"}}>
          <button className="btn ghost" onClick={onSim}>← Back to tree</button>
          <button className="btn ghost" onClick={onBack}>Home</button>
        </div>
      </div>
    );
  }

  const SCENARIO = scenario;
  const BRANCHES = scenario.branches;
  const NESTED = scenario.nested;
  const OUTCOME_SCHEMA = scenario.outcome_schema || [];

  const allBranches = [...BRANCHES, ...NESTED.map(n => ({ ...n, nested: true }))];
  const validBranches = allBranches.filter(b => b.valid);

  const primary = SCENARIO.primary;
  const primarySchema = OUTCOME_SCHEMA.find(o => o.name === primary);
  const primaryRange = primarySchema?.range || [0, 1];
  const isPctOutcome = primaryRange[1] === 1 && primaryRange[0] === 0;

  // Headline aggregate from server-provided distribution if available;
  // otherwise compute on the fly from valid branches.
  const headline = useMemoA(() => {
    const serverDist = primary ? (SCENARIO.distributions || {})[primary] : null;
    if (serverDist) {
      const vals = serverDist.values || [];
      const variance = vals.length > 1
        ? vals.reduce((a, b) => a + (b - serverDist.mean) ** 2, 0) / (vals.length - 1)
        : 0;
      const se = Math.sqrt(variance / Math.max(1, vals.length));
      return {
        mean: serverDist.mean,
        median: serverDist.median,
        p10: vals[Math.floor(0.1 * (vals.length - 1))] ?? serverDist.min,
        p90: vals[Math.floor(0.9 * (vals.length - 1))] ?? serverDist.max,
        min: serverDist.min,
        max: serverDist.max,
        n: serverDist.n,
        vals,
        ciLow: Math.max(primaryRange[0], serverDist.mean - 1.96 * se),
        ciHigh: Math.min(primaryRange[1], serverDist.mean + 1.96 * se),
      };
    }
    const vals = validBranches
      .map(b => b.outcomes?.[primary])
      .filter(v => typeof v === "number");
    const n = vals.length;
    if (!n) return { mean: 0, median: 0, p10: 0, p90: 0, min: 0, max: 0, n: 0, vals: [], ciLow: 0, ciHigh: 0 };
    const sorted = [...vals].sort((a,b) => a-b);
    const mean = vals.reduce((a,b) => a+b, 0) / n;
    const median = n % 2 ? sorted[(n-1)/2] : (sorted[n/2 - 1] + sorted[n/2]) / 2;
    const pct = p => sorted[Math.max(0, Math.min(n-1, Math.round(p*(n-1))))];
    const variance = vals.reduce((a,b) => a + (b-mean)**2, 0) / Math.max(1, n-1);
    const se = Math.sqrt(variance / n);
    return {
      mean, median, p10: pct(0.1), p90: pct(0.9), min: sorted[0], max: sorted[n-1], n,
      vals: sorted,
      ciLow: Math.max(primaryRange[0], mean - 1.96 * se),
      ciHigh: Math.min(primaryRange[1], mean + 1.96 * se),
    };
  }, [scenario]);

  // Derive take-aways from the data itself instead of hardcoded per-scenario copy.
  const takeaways = useMemoA(() => {
    const out = [];
    // 1. spread / uncertainty
    const spread = headline.max - headline.min;
    if (headline.n >= 3) {
      const consensus = spread < 0.25 ? "tight" : spread < 0.5 ? "moderate" : "wide";
      out.push({
        num: headline.n + " branches",
        title: `${consensus[0].toUpperCase() + consensus.slice(1)} consensus`,
        body: `${(headline.min*100).toFixed(0)}–${(headline.max*100).toFixed(0)}% range across the ensemble. Median ${isPctOutcome ? (headline.median*100).toFixed(0)+'%' : headline.median.toFixed(1)}, mean ${isPctOutcome ? (headline.mean*100).toFixed(0)+'%' : headline.mean.toFixed(1)}.`,
      });
    }
    // 2. dominant categorical
    const boolStats = OUTCOME_SCHEMA.filter(o => (o.type||"").toLowerCase() === "bool").map(s => {
      const vals = validBranches.map(b => b.outcomes?.[s.name]).filter(v => typeof v === "boolean");
      const n = vals.length;
      const trueN = vals.filter(v => v).length;
      return { name: s.name, n, trueN, p: n ? trueN / n : 0 };
    });
    const topBool = boolStats.filter(b => b.n >= 2).sort((a,b) => Math.abs(b.p - 0.5) - Math.abs(a.p - 0.5))[0];
    if (topBool) {
      out.push({
        num: `${topBool.trueN}/${topBool.n}`,
        title: topBool.p >= 0.5 ? `${topBool.name.replace(/_/g, " ")} fires` : `${topBool.name.replace(/_/g, " ")} rare`,
        body: `${(topBool.p*100).toFixed(0)}% of valid branches showed this signal — ${topBool.p >= 0.5 ? "robust feature, not a swing variable" : "an outlier signal worth flagging"}.`,
      });
    }
    // 3. validity
    const invalidN = allBranches.length - validBranches.length;
    if (invalidN > 0) {
      out.push({
        num: `${invalidN}/${allBranches.length}`,
        title: "Invalidated runs",
        body: `${invalidN} branch${invalidN === 1 ? "" : "es"} dropped by validity checks. Without them, the ensemble would be artificially noisy.`,
      });
    } else if (allBranches.length > 0) {
      out.push({
        num: `${allBranches.length}/${allBranches.length}`,
        title: "All branches valid",
        body: "No branches dropped by post-hoc validity checks — the cohort is clean.",
      });
    }
    return out;
  }, [scenario]);

  // Dynamic table columns from schema
  const tableCols = OUTCOME_SCHEMA
    .filter(o => o.name !== primary && ["float","int","number"].includes((o.type||"").toLowerCase()))
    .map(o => ({ key: o.name, label: o.name.replace(/_/g, " "),
      fmt: (o.range && o.range[1] === 1 && o.range[0] === 0) ? "pct" : "f1" }))
    .slice(0, 4);
  const tagCols = OUTCOME_SCHEMA
    .filter(o => (o.type||"").toLowerCase() === "bool")
    .map(o => ({ key: o.name, label: o.name.split("_")[0] }));

  const sortedBranches = useMemoA(() => {
    const arr = [...allBranches];
    arr.sort((a, b) => {
      let av, bv;
      if (sortBy === "primary") { av = a.outcomes?.[primary]; bv = b.outcomes?.[primary]; }
      else if (sortBy === "label") { av = a.label; bv = b.label; }
      else { av = a.outcomes?.[sortBy]; bv = b.outcomes?.[sortBy]; }
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [sortBy, sortDir, scenario]);

  const setSort = (col) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const fmt = (v, f) => v == null ? "—" : f === "pct" ? (v*100).toFixed(0)+"%" : v.toFixed(1);

  // Auto-derived "Read" line from data shape
  const readShort = useMemoA(() => {
    if (headline.n === 0) return "No numeric outcomes yet — waiting on classifier.";
    const polarity = headline.median > 0.66 ? "high" : headline.median > 0.33 ? "moderate" : "low";
    const widthDesc = (headline.max - headline.min) > 0.5 ? "with sharp disagreement" : "with broad agreement";
    return `Across ${headline.n} valid branch${headline.n === 1 ? "" : "es"}, the ensemble assigns a ${polarity} ${SCENARIO.primary_label} ${widthDesc} (${(headline.min*100).toFixed(0)}–${(headline.max*100).toFixed(0)}%).`;
  }, [scenario]);

  return (
    <div className="analysis">
      <div className="analysis-head">
        <div>
          <div className="eyebrow">Run analysis · {SCENARIO.name}</div>
          <h2><em>{SCENARIO.primary_label}</em></h2>
          <p>{SCENARIO.description}</p>
        </div>
        <div className="analysis-head-meta">
          <div><strong>{validBranches.length} / {allBranches.length}</strong> valid branches</div>
          <div>parent · {SCENARIO.parent_sim_id}</div>
          <div>fork @ r{SCENARIO.fork_round} · horizon r{SCENARIO.horizon_rounds}</div>
          <div>finished {SCENARIO.ts}</div>
        </div>
      </div>

      <div className="headline-prob">
        <div className="prob-num">
          <div>
            <div className="label">Headline · {SCENARIO.primary_label}</div>
            <div className="big">
              <em>{isPctOutcome ? (headline.mean*100).toFixed(0) : headline.mean.toFixed(1)}</em>
              {isPctOutcome ? "%" : ""}
            </div>
            <div className="ci">
              {isPctOutcome
                ? `95% CI · ${(headline.ciLow*100).toFixed(0)}% – ${(headline.ciHigh*100).toFixed(0)}%`
                : `95% CI · ${headline.ciLow.toFixed(2)} – ${headline.ciHigh.toFixed(2)}`}
            </div>
          </div>
          <div className="meta">
            <strong>Read:</strong> {readShort}
          </div>
        </div>
        <div className="dist-pane">
          <div className="head">
            <h5>Distribution across branches</h5>
            <div className="legend">n = {headline.n}</div>
          </div>
          <DistributionChart values={headline.vals} mean={headline.mean} median={headline.median} range={primaryRange} />
          <div className="dist-stats">
            <div>min<span className="v">{isPctOutcome ? (headline.min*100).toFixed(0)+"%" : headline.min.toFixed(1)}</span></div>
            <div>p10<span className="v">{isPctOutcome ? (headline.p10*100).toFixed(0)+"%" : headline.p10.toFixed(1)}</span></div>
            <div>median<span className="v">{isPctOutcome ? (headline.median*100).toFixed(0)+"%" : headline.median.toFixed(1)}</span></div>
            <div>p90<span className="v">{isPctOutcome ? (headline.p90*100).toFixed(0)+"%" : headline.p90.toFixed(1)}</span></div>
            <div>max<span className="v">{isPctOutcome ? (headline.max*100).toFixed(0)+"%" : headline.max.toFixed(1)}</span></div>
          </div>
        </div>
      </div>

      <h3 className="section-title">Take-aways</h3>
      <p className="section-sub">Derived from the data — not hand-written.</p>
      <div className="takeaways">
        {takeaways.map((t, i) => (
          <div className="takeaway" key={i}>
            <div className="num">{t.num}</div>
            <h6>{t.title}</h6>
            <p>{t.body}</p>
          </div>
        ))}
      </div>

      <h3 className="section-title">Numeric outcomes</h3>
      <p className="section-sub">Distributions across {validBranches.length} valid branches.</p>
      <div className="outcome-grid">
        {OUTCOME_SCHEMA.filter(o => ["float","int","number"].includes((o.type||"").toLowerCase()) && o.name !== primary).map(schema => {
          const vals = validBranches.map(b => b.outcomes?.[schema.name]).filter(v => typeof v === "number");
          if (!vals.length) return null;
          const sorted = [...vals].sort((a,b) => a-b);
          const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
          const median = sorted[Math.floor(sorted.length/2)];
          const range = schema.range || [sorted[0], sorted[sorted.length-1]];
          const isPct = range[1] === 1 && range[0] === 0;
          return (
            <div className="outcome-card" key={schema.name}>
              <div className="label">numeric · range [{range[0]}, {range[1]}]</div>
              <div className="name">{schema.name}</div>
              <div className="desc">{schema.description}</div>
              <MiniDist values={sorted} range={range} />
              <div className="nums">
                <div>mean<strong>{isPct ? (mean*100).toFixed(0)+"%" : mean.toFixed(2)}</strong></div>
                <div>median<strong>{isPct ? (median*100).toFixed(0)+"%" : median.toFixed(2)}</strong></div>
                <div>min<strong>{isPct ? (sorted[0]*100).toFixed(0)+"%" : sorted[0].toFixed(2)}</strong></div>
                <div>max<strong>{isPct ? (sorted[sorted.length-1]*100).toFixed(0)+"%" : sorted[sorted.length-1].toFixed(2)}</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Categorical outcomes</h3>
      <p className="section-sub">Wilson-style boolean rate across valid branches.</p>
      <div className="bool-bars">
        {OUTCOME_SCHEMA.filter(o => (o.type||"").toLowerCase() === "bool").map(schema => {
          const vals = validBranches.map(b => b.outcomes?.[schema.name]).filter(v => typeof v === "boolean");
          const n = vals.length;
          const trueN = vals.filter(v => v).length;
          const p = n ? trueN / n : 0;
          return (
            <div className="bool-row" key={schema.name}>
              <div className="info">
                <div className="name">{schema.name}</div>
                <div className="desc">{schema.description}</div>
              </div>
              <div className="bar"><div className="fill" style={{width: `${p*100}%`}} /></div>
              <div className="pct">{(p*100).toFixed(0)}% <span style={{color:"var(--fg-3)", fontSize: 11}}>({trueN}/{n})</span></div>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Per-branch breakdown</h3>
      <p className="section-sub">Sorted by headline — click any column to re-sort.</p>
      <table className="branch-table">
        <thead>
          <tr>
            <th onClick={() => setSort("label")}>Branch ↕</th>
            <th onClick={() => setSort("primary")}>{SCENARIO.primary_label} ↕</th>
            {tableCols.map(c => (
              <th key={c.key} onClick={() => setSort(c.key)}>{c.label} ↕</th>
            ))}
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {sortedBranches.map(b => {
            const v = b.outcomes?.[primary];
            const color = window.rampColor ? window.rampColor(v, primaryRange[0], primaryRange[1]) : "#888";
            return (
              <tr key={b.child_sim_id || b.label}>
                <td className="name">
                  <span className="swatch" style={{background: color}}></span>
                  {b.label}
                  <span className="dim">{b.child_sim_id}{b.nested ? " · nested" : ""}</span>
                </td>
                <td className="num">{v != null ? (isPctOutcome ? (v*100).toFixed(0)+"%" : v.toFixed(2)) : "—"}</td>
                {tableCols.map(c => (
                  <td key={c.key} className="num">{fmt(b.outcomes?.[c.key], c.fmt)}</td>
                ))}
                <td style={{fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--fg-3)"}}>
                  {tagCols.map(t => (
                    b.outcomes?.[t.key] && <span key={t.key} style={{marginRight: 6}}>{t.label}</span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{display:"flex", justifyContent:"space-between", paddingTop: 32, borderTop: "1px solid var(--rule)"}}>
        <button className="btn ghost" onClick={onSim}>← Back to tree</button>
        <button className="btn ghost" onClick={onBack}>Home</button>
      </div>
    </div>
  );
}

function DistributionChart({ values, mean, median, range }) {
  const W = 580, H = 200, M = { t: 16, r: 16, b: 30, l: 16 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const [lo, hi] = range || [0, 1];
  const bins = 12;
  const counts = Array(bins).fill(0);
  values.forEach(v => {
    const t = (v - lo) / (hi - lo);
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
    counts[idx]++;
  });
  const maxC = Math.max(...counts, 1);
  const barW = innerW / bins;
  const xOf = v => ((v - lo) / (hi - lo)) * innerW;
  const isPct = hi === 1 && lo === 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dist-svg">
      <g transform={`translate(${M.l}, ${M.t})`}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const x = t * innerW;
          const labelV = lo + t * (hi - lo);
          return (
            <g key={t}>
              <line x1={x} y1={0} x2={x} y2={innerH} stroke="var(--rule-2)" strokeDasharray="2 4" />
              <text x={x} y={innerH + 18} textAnchor="middle"
                style={{fontFamily:"var(--font-mono)", fontSize: 10, fill:"var(--fg-3)"}}>
                {isPct ? (labelV*100).toFixed(0)+"%" : labelV.toFixed(1)}
              </text>
            </g>
          );
        })}
        {counts.map((c, i) => {
          const h = (c / maxC) * innerH;
          const x = i * barW;
          const t = (i + 0.5) / bins;
          const color = window.rampColor ? window.rampColor(t, 0, 1) : "#3b82f6";
          return (
            <rect key={i}
              x={x + 2} y={innerH - h}
              width={barW - 4} height={h}
              fill={color} opacity={0.85}
              rx={2}>
              <animate attributeName="height" from="0" to={h} dur="600ms" fill="freeze" />
              <animate attributeName="y" from={innerH} to={innerH - h} dur="600ms" fill="freeze" />
            </rect>
          );
        })}
        <line x1={xOf(mean)} y1={-4} x2={xOf(mean)} y2={innerH}
          stroke="var(--fg)" strokeWidth={1.4} strokeDasharray="4 3" />
        <text x={xOf(mean)} y={-8} textAnchor="middle"
          style={{fontFamily:"var(--font-mono)", fontSize: 10, fill:"var(--fg)"}}>
          mean {isPct ? (mean*100).toFixed(0)+"%" : mean.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}

function MiniDist({ values, range }) {
  const W = 400, H = 100;
  const [lo, hi] = range;
  const bins = 8;
  const counts = Array(bins).fill(0);
  values.forEach(v => {
    const t = (v - lo) / (hi - lo);
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(t * bins)));
    counts[idx]++;
  });
  const maxC = Math.max(...counts, 1);
  const barW = W / bins;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-svg">
      {counts.map((c, i) => {
        const h = (c / maxC) * (H - 16);
        const t = (i + 0.5) / bins;
        const color = window.rampColor ? window.rampColor(t, 0, 1) : "#3b82f6";
        return (
          <rect key={i}
            x={i*barW + 2} y={H - 16 - h}
            width={barW - 4} height={h}
            fill={color} opacity={0.8} rx={2} />
        );
      })}
      <line x1={0} y1={H-16} x2={W} y2={H-16} stroke="var(--rule)" />
      <text x={0} y={H-2} style={{fontFamily:"var(--font-mono)", fontSize: 10, fill:"var(--fg-3)"}}>{lo}</text>
      <text x={W} y={H-2} textAnchor="end" style={{fontFamily:"var(--font-mono)", fontSize: 10, fill:"var(--fg-3)"}}>{hi}</text>
    </svg>
  );
}

window.AnalysisPage = AnalysisPage;
