/* Pages: Home, Simulation (live-data version).
 *
 * Live changes vs the design's mock version:
 *  - Branches/nested come from live polled data, not hardcoded.
 *  - SimulationPage doesn't fake-animate; the tree grows naturally as new
 *    children appear in subsequent polls.
 *  - All async states (loading, error, empty) are handled.
 */

const { useState, useEffect, useMemo } = React;

// ─── HOME ────────────────────────────────────────────────────────────
function HomePage({ scenario, runs, loading, err, onStart, onOpenRun, onPickScenario }) {
  return (
    <div className="home">
      <section className="hero">
        <div>
          <div className="eyebrow">Probabilistic agent simulation · v0.5</div>
          <h1>Fork the timeline.<br/>Forecast <em>plausible</em> futures.</h1>
          <p>
            Spin up an ensemble of N parallel agent populations, each pushed in a
            different direction by a generated event + persona perturbation.
            Watch them diverge into distinct futures, then read the probability
            distribution back out.
          </p>
        </div>
        <aside className="hero-aside">
          <dl>
            <dt>method</dt><dd>state-fork at round k, perturb, run to horizon</dd>
            <dt>generator</dt><dd>God-LLM (gemini-3.1-flash)</dd>
            <dt>classifier</dt><dd>schema-driven, per-branch</dd>
            <dt>aggregation</dt><dd>Wilson 95% CI on bool, p10/p50/p90 on float</dd>
          </dl>
        </aside>
      </section>

      <section className="scenario-pane">
        <div className="scenario-left">
          <div className="scenario-header-row">
            <div className="eyebrow">Active run</div>
            <div className="scenario-chips">
              {runs.slice(0, 6).map(r => (
                <button
                  key={r.id}
                  className={`scenario-chip ${r.id === scenario?.id ? "on" : ""}`}
                  onClick={() => onPickScenario(r.id)}
                  title={r.id}
                >
                  {r.scenario.replace(/ cascade| smoke test/g, "")}
                </button>
              ))}
            </div>
          </div>
          <h2>{scenario?.title || (loading ? "loading…" : "no run selected")}</h2>
          <p>{err
            ? <span style={{color: "var(--bad)"}}>error: {err}</span>
            : (scenario?.description || "Pick a past run from the chips, or start a new ensemble below.")}</p>
          {scenario && (
            <div className="config-list" style={{marginTop: 24}}>
              <dt>parent</dt>
              <dd>{scenario.parent_sim_id}</dd>
              <dt>branches</dt>
              <dd>
                <span className="pill">N = {scenario.num_branches}</span>
                {scenario.nested.length > 0 && (
                  <span className="pill">+{scenario.nested.length} nested @ r{scenario.nested[0].fork_round}</span>
                )}
              </dd>
              <dt>horizon</dt>
              <dd>{scenario.horizon_rounds} rounds · fork @ r{scenario.fork_round}</dd>
              <dt>phase</dt>
              <dd>{scenario.phase}</dd>
            </div>
          )}
        </div>
        <div className="scenario-right">
          <div>
            <div className="eyebrow">Outcomes tracked</div>
            <ul style={{listStyle: "none", padding: 0, margin: "16px 0", fontSize: 13, lineHeight: 1.9, fontFamily: "var(--font-mono)", color: "var(--fg-2)"}}>
              {scenario?.primary && (
                <li>· {scenario.primary} <span style={{color:"var(--accent)"}}>★ primary</span></li>
              )}
              {(scenario?.outcome_schema || []).filter(o =>
                ["float","int","number"].includes((o.type || "").toLowerCase()) && o.name !== scenario.primary
              ).map(o => (<li key={o.name}>· {o.name}</li>))}
              {scenario && (
                <li>· {(scenario.outcome_schema || []).filter(o => (o.type || "").toLowerCase() === "bool").length} categorical bool outcomes</li>
              )}
              {!scenario && <li style={{color: "var(--fg-3)"}}>(select or start a run)</li>}
            </ul>
          </div>
          <div className="start-row">
            <button className="btn lg accent" onClick={onStart}>
              <span style={{fontSize: 16, lineHeight: 1}}>▶</span> Start ensemble
            </button>
            <span className="hint">~30 min · ~$3 budget</span>
          </div>
          <div className="lock-line">
            <span style={{fontFamily: "var(--font-mono)"}}>⌥</span>
            Live demo. Backend: WorldFork-v1 on :5050.
          </div>
        </div>
      </section>

      <section className="runs-section">
        <h3>Past runs</h3>
        <div className="sub">Click any row to open its analysis.</div>
        <table className="runs-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Branches</th>
              <th>Run</th>
              <th>Finished</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td colSpan="5" style={{color: "var(--fg-3)", padding: 24, textAlign: "center"}}>no runs yet — start one above</td></tr>
            )}
            {runs.map(r => (
              <tr key={r.id} onClick={() => onOpenRun(r.id)}>
                <td className="scenario">{r.scenario}<div style={{fontFamily:"var(--font-mono)", color:"var(--fg-3)", fontSize:11, marginTop:3}}>{r.id}</div></td>
                <td className="ratio">{r.n_valid}/{r.n_total} <span style={{color:"var(--fg-3)"}}>valid</span></td>
                <td style={{fontFamily:"var(--font-mono)", fontSize: 12, color: "var(--fg-3)"}}>{r.id.slice(0, 24)}</td>
                <td className="timestamp">{r.ts}</td>
                <td className="arrow">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ─── SIMULATION ─────────────────────────────────────────────────────
function SimulationPage({ scenario, loading, err, autoStartedAt, onAnalysis }) {
  const [selected, setSelected] = useState(null);
  const [includeNested, setIncludeNested] = useState(true);

  // Reset selection when switching to a different run
  useEffect(() => { setSelected(null); }, [scenario?.id]);

  if (err) {
    return (
      <div className="sim-page" style={{padding: 32}}>
        <div className="empty-detail" style={{maxWidth: 480}}>
          <div className="ic">!</div>
          <div style={{color: "var(--bad)"}}>Failed to load run: {err}</div>
        </div>
      </div>
    );
  }
  if (loading || !scenario) {
    return (
      <div className="sim-page" style={{padding: 32}}>
        <div className="empty-detail" style={{maxWidth: 480}}>
          <div className="ic">…</div>
          <div>Loading run state…</div>
        </div>
      </div>
    );
  }

  const BRANCHES = scenario.branches;
  const NESTED = scenario.nested;
  const SCENARIO = scenario;
  const done = scenario.phase === "complete";

  // Headline live summary
  const primaryName = SCENARIO.primary;
  const validForPrimary = [...BRANCHES, ...NESTED].filter(b => b.valid && b.outcomes && b.outcomes[primaryName] != null);
  const summary = useMemo(() => {
    if (!validForPrimary.length) return null;
    const vals = validForPrimary.map(b => b.outcomes[primaryName]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean, n: vals.length };
  }, [scenario]);

  const selectedBranch = useMemo(() => {
    if (!selected) return null;
    if (selected.startsWith("b_")) return BRANCHES.find(b => `b_${b.label}` === selected);
    if (selected.startsWith("n_")) return NESTED.find(b => `n_${b.label}` === selected);
    return null;
  }, [selected, scenario]);

  return (
    <div className="sim-page">
      <div className="sim-meta-bar">
        <div className="sim-meta-left">
          <div className="phase-chip">
            <span className={`dot ${done ? "" : "run"}`}></span>
            {scenario.phase}
          </div>
          <div className="sim-stats">
            <div><strong className="num">{BRANCHES.length}</strong> branches</div>
            {summary && (
              <div>{SCENARIO.primary_label} = <strong className="num">{(summary.mean*100).toFixed(1)}%</strong></div>
            )}
            <div>fork @ <strong className="num">r{SCENARIO.fork_round}</strong></div>
            <div>horizon <strong className="num">r{SCENARIO.horizon_rounds}</strong></div>
            {NESTED.length > 0 && (
              <div>nested · <strong className="num">{NESTED.length}</strong></div>
            )}
          </div>
        </div>
        <div style={{display:"flex", gap: 12, alignItems:"center"}}>
          <span className="mono" style={{fontSize:11, color:"var(--fg-3)"}}>{SCENARIO.parent_sim_id}</span>
          {(done || scenario.manifest_present) && (
            <button className="btn accent" onClick={onAnalysis}>
              View analysis →
            </button>
          )}
        </div>
      </div>

      <div className="sim-body">
        <div className="tree-pane" style={{overflow: "auto"}}>
          <div className="tree-toolbar">
            <div className="seg">
              <button className={includeNested ? "on" : ""} onClick={() => setIncludeNested(true)}>w/ nested</button>
              <button className={!includeNested ? "on" : ""} onClick={() => setIncludeNested(false)}>primary only</button>
            </div>
          </div>

          {BRANCHES.length === 0 ? (
            <div style={{padding: 80, color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 13}}>
              waiting for first child branches…<br/>
              <span style={{fontSize: 11}}>parent {SCENARIO.parent_sim_id} · phase {SCENARIO.phase}</span>
            </div>
          ) : (
            <window.TreeView
              scenario={SCENARIO}
              branches={BRANCHES}
              nested={NESTED}
              progress={1}
              selected={selected}
              onSelect={(n) => setSelected(n.id)}
              includeNested={includeNested}
            />
          )}

          <div className="tree-legend">
            <span>{SCENARIO.primary_label}</span>
            <span style={{color:"var(--fg)"}}>0%</span>
            <span className="ramp"></span>
            <span style={{color:"var(--fg)"}}>100%</span>
          </div>

          {done && (
            <div className="completion-banner">
              <div className="text">
                <strong>Ensemble complete</strong>
                <span>{scenario.n_valid}/{scenario.n_total} branches valid · classified</span>
              </div>
              <button className="btn" onClick={onAnalysis}>View analysis →</button>
            </div>
          )}
        </div>

        <div className="detail-pane">
          {!selectedBranch && (
            <div>
              <div className="eyebrow" style={{marginBottom: 12}}>Branch detail</div>
              <div className="empty-detail">
                <div className="ic">?</div>
                <div>
                  Click any leaf to inspect its perturbation event,
                  agent mood modifier, classifier reasoning, and outcome scores.
                </div>
                <div style={{paddingTop: 12, borderTop: "1px solid var(--rule)", width:"100%", marginTop: 12}}>
                  <div className="eyebrow" style={{marginBottom: 10}}>Reading the tree</div>
                  <div style={{fontSize: 12, lineHeight: 1.7, color:"var(--fg-2)"}}>
                    The trunk is the shared parent population. At <span className="mono" style={{color:"var(--fg)"}}>r{SCENARIO.fork_round}</span> it forks into {BRANCHES.length} siblings, each receiving a distinct God-LLM event.
                    {NESTED.length > 0 && (
                      <> Branch <span className="mono" style={{color:"var(--fg)"}}>0</span> is forked again at <span className="mono" style={{color:"var(--fg)"}}>r{NESTED[0].fork_round}</span>.</>
                    )}
                    <br/><br/>
                    Color encodes the headline outcome — green = low probability, magenta = high.
                  </div>
                </div>
              </div>
            </div>
          )}
          {selectedBranch && <BranchDetail branch={selectedBranch} scenario={SCENARIO} />}
        </div>
      </div>
    </div>
  );
}

function BranchDetail({ branch, scenario }) {
  const o = branch.outcomes || {};
  return (
    <div>
      <div className="eyebrow">Branch · {branch.fork_round ? `nested r${branch.fork_round}` : `r${scenario.fork_round} fork`}</div>
      <h4>{branch.label}</h4>
      <div className="sub-id">{branch.child_sim_id}</div>

      {branch.perturbation && branch.perturbation !== "—" && (
        <div className="detail-section">
          <div className="label">Perturbation event</div>
          <div className="quote">{branch.perturbation}</div>
        </div>
      )}

      {branch.mood && branch.mood !== "—" && (
        <div className="detail-section">
          <div className="label">Mood modifier · private to agents</div>
          <div className="body">{branch.mood}</div>
        </div>
      )}

      {Object.keys(o).length > 0 && (
        <div className="detail-section">
          <div className="label">Outcomes</div>
          <div className="outcome-rows">
            {Object.entries(o).map(([k, v]) => {
              let cls = "";
              let display = "—";
              if (typeof v === "boolean") {
                cls = v ? "bool-yes" : "bool-no";
                display = v ? "yes" : "no";
              } else if (typeof v === "number") {
                const schema = (scenario.outcome_schema || []).find(s => s.name === k);
                if (schema?.range && schema.range[1] === 1) display = (v*100).toFixed(0) + "%";
                else display = v.toFixed(2);
              }
              return (
                <React.Fragment key={k}>
                  <div className="k">{k}</div>
                  <div className={`v ${cls}`}>{display}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {branch.reasoning && (
        <div className="detail-section">
          <div className="label">{branch.valid === false ? "Invalid reason" : "Classifier reasoning"}</div>
          <div className="body">{branch.reasoning}</div>
        </div>
      )}

      <div className="detail-section">
        <div className="label">Live state</div>
        <div className="body" style={{fontFamily: "var(--font-mono)", fontSize: 12}}>
          status · {branch.runner_status || "?"}<br/>
          round · {branch.current_round || 0} / {branch.total_rounds || "?"}
        </div>
      </div>
    </div>
  );
}

window.HomePage = HomePage;
window.SimulationPage = SimulationPage;
