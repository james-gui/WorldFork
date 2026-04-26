/* App shell — routes, top bar, tweaks, scenario selection.
 *
 * v2 wires every page to live data via window.WF_API. Picking a scenario
 * means picking a run_id; an in-flight run is polled every 3s until it
 * reaches a terminal phase.
 */

const { useState: useS, useEffect: useE, useRef: useR } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "speed": 1,
  "showGrain": true,
  "accent": "oklch(0.72 0.16 175)",
  "headlineStyle": "serif",
}/*EDITMODE-END*/;

const POLL_INTERVAL_MS = 3000;
const TERMINAL_PHASES = new Set(["complete", "failed"]);

function App() {
  const [route, setRoute] = useS("home");
  const [runs, setRuns] = useS([]);            // list from /api/runs
  const [scenarioId, setScenarioId] = useS(null);
  const [scenario, setScenario] = useS(null);  // adapted lineage payload
  const [scenarioErr, setScenarioErr] = useS(null);
  const [autoStartedAt, setAutoStartedAt] = useS(null); // when /start was just called
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  // Apply tweaks
  useE(() => {
    document.documentElement.style.setProperty("--accent", tweaks.accent || "oklch(0.72 0.16 175)");
    if (!tweaks.showGrain) {
      const css = document.getElementById("grainOff");
      if (!css) {
        const s = document.createElement("style");
        s.id = "grainOff";
        s.textContent = "body::before { display: none !important; }";
        document.head.appendChild(s);
      }
    } else {
      const s = document.getElementById("grainOff");
      if (s) s.remove();
    }
  }, [tweaks]);

  // ── Initial load: fetch runs list ───────────────────────────────────
  const refreshRuns = async () => {
    try {
      const list = await window.WF_API.listRuns();
      setRuns(list);
      // Default-select the most recent if nothing selected yet
      setScenarioId(prev => prev || (list[0]?.id || null));
      return list;
    } catch (e) {
      console.error("listRuns failed", e);
      return [];
    }
  };
  useE(() => { refreshRuns(); }, []);

  // ── Whenever scenarioId changes, fetch its full state ───────────────
  useE(() => {
    if (!scenarioId) { setScenario(null); return; }
    let cancelled = false;
    const run = runs.find(r => r.id === scenarioId);
    setScenarioErr(null);
    window.WF_API.getScenario(scenarioId, run)
      .then(sc => { if (!cancelled) setScenario(sc); })
      .catch(e => { if (!cancelled) { setScenarioErr(e.message); setScenario(null); }});
    return () => { cancelled = true; };
  }, [scenarioId, runs]);

  // ── Live polling for in-flight runs ─────────────────────────────────
  useE(() => {
    if (!scenarioId) return;
    if (scenario && TERMINAL_PHASES.has(scenario.phase)) return;
    if (!scenario) return;
    const t = setInterval(async () => {
      try {
        const run = runs.find(r => r.id === scenarioId);
        const sc = await window.WF_API.getScenario(scenarioId, run);
        setScenario(sc);
        if (TERMINAL_PHASES.has(sc.phase)) refreshRuns();
      } catch (e) {
        console.warn("poll error", e);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [scenarioId, scenario?.phase]);

  // ── Actions ─────────────────────────────────────────────────────────
  const goSim = () => setRoute("sim");
  const goAnalysis = () => setRoute("analysis");
  const goHome = () => setRoute("home");

  const switchScenario = (runId) => {
    if (!runId) return;
    setScenarioId(runId);
    setAutoStartedAt(null);
  };

  const openRun = (runId) => {
    setScenarioId(runId);
    setAutoStartedAt(null);
    setRoute("analysis");
  };

  const startNewRun = async () => {
    try {
      const newRunId = await window.WF_API.startNewRun();
      setAutoStartedAt(Date.now());
      setScenarioId(newRunId);
      setTimeout(() => refreshRuns(), 1500);
      setRoute("sim");
    } catch (e) {
      alert("Failed to start ensemble: " + e.message);
    }
  };

  // ── Top-bar state pill ──────────────────────────────────────────────
  const dotMode = !scenario ? "idle"
    : scenario.phase === "complete" ? ""
    : scenario.phase === "failed" ? "idle"
    : "run";
  const phaseText = !scenario ? "ready" : scenario.phase || "—";

  const scenarioOptions = runs.map(r => ({
    runId: r.id, canonicalId: r.id, label: r.scenario, ts: r.ts, isSnapshot: false,
  }));

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">world<em>/</em>fork</div>
          <div className="brand-tag">v0.5 · ensemble forecast · live</div>
        </div>
        <div className="topnav">
          <a className={route === "home" ? "active" : ""} onClick={goHome} style={{cursor:"pointer"}}>Home</a>
          <a className={route === "sim" ? "active" : ""} onClick={goSim} style={{cursor:"pointer"}}>Simulation</a>
          <a className={route === "analysis" ? "active" : ""} onClick={goAnalysis} style={{cursor:"pointer"}}>Analysis</a>
        </div>
        <div className="topbar-meta">
          <ScenarioPicker
            value={scenarioId}
            options={scenarioOptions}
            onChange={switchScenario}
            currentScenario={scenario}
          />
          <span className="topbar-sep" />
          <span className={`dot ${dotMode}`}></span>
          <span>{phaseText}</span>
        </div>
      </div>

      {route === "home" && (
        <HomePage
          scenario={scenario}
          scenarioId={scenarioId}
          runs={runs}
          loading={!scenario && !scenarioErr}
          err={scenarioErr}
          onPickScenario={switchScenario}
          onStart={startNewRun}
          onOpenRun={openRun}
        />
      )}
      {route === "sim" && (
        <SimulationPage
          scenario={scenario}
          loading={!scenario && !scenarioErr}
          err={scenarioErr}
          autoStartedAt={autoStartedAt}
          speed={tweaks.speed || 1}
          onAnalysis={goAnalysis}
        />
      )}
      {route === "analysis" && (
        <AnalysisPage
          scenario={scenario}
          loading={!scenario && !scenarioErr}
          err={scenarioErr}
          onBack={goHome}
          onSim={goSim}
        />
      )}

      <div className="foot">
        <div>worldfork · agent-simulation forecasting</div>
        <div>{route} · {scenario?.name || "—"} · live</div>
      </div>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks" tweaks={tweaks} setTweak={setTweak}>
          <window.TweakSection title="Surface">
            <window.TweakColor label="Accent" value={tweaks.accent} onChange={v => setTweak("accent", v)} />
            <window.TweakToggle label="Paper grain overlay" value={tweaks.showGrain} onChange={v => setTweak("showGrain", v)} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </>
  );
}

function ScenarioPicker({ value, options, onChange, currentScenario }) {
  const [open, setOpen] = useS(false);
  const ref = useR(null);
  useE(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentLabel = currentScenario?.title
    || currentScenario?.name
    || (value ? value.slice(0, 24) : "—");

  return (
    <div className="scenario-picker" ref={ref}>
      <button className={`scenario-picker-btn ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
        <span className="scenario-picker-eyebrow">run</span>
        <span className="scenario-picker-title">{currentLabel}</span>
        <span className="scenario-picker-caret">▾</span>
      </button>
      {open && (
        <div className="scenario-picker-menu" role="listbox">
          <div className="scenario-picker-head">past runs · {options.length}</div>
          {options.length === 0 && (
            <div className="scenario-picker-foot">no runs yet · click Start ensemble</div>
          )}
          {options.map(opt => {
            const isCurrent = opt.runId === value;
            return (
              <button
                key={opt.runId}
                role="option"
                aria-selected={isCurrent}
                className={`scenario-picker-item ${isCurrent ? "current" : ""}`}
                onClick={() => { onChange(opt.runId); setOpen(false); }}
              >
                <div className="scenario-picker-item-main">
                  <div className="scenario-picker-item-title">{opt.label}</div>
                  <div className="scenario-picker-item-id">{opt.runId}</div>
                </div>
                <div className="scenario-picker-item-meta">
                  <div className="scenario-picker-item-ts">{opt.ts}</div>
                </div>
              </button>
            );
          })}
          <div className="scenario-picker-foot">
            <span>—</span> live data sourced from /api/runs
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
