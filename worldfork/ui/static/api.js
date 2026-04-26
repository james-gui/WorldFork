/* Live data layer — fetch + adapt from v1 backend.
 *
 * Replaces the mock SCENARIOS in data.js. All data flows through here so
 * components only see a normalized "scenario" shape regardless of whether
 * the run is in-flight or historical.
 *
 * Endpoints (proxied to v1 on :5050 by server.py):
 *   GET  /api/runs                       → list of past runs
 *   GET  /api/run/<id>/lineage           → tree + manifest + distributions
 *   POST /api/start                      → kick off a new ensemble
 */

(function () {
  function safe(x, fallback) { return (x === null || x === undefined) ? fallback : x; }

  // Best-effort label for a primary outcome — most are P(...) probabilities,
  // some are float scores in [0, 10].
  function labelForPrimary(name, range) {
    if (!name) return "—";
    if (range && range[1] === 1 && range[0] === 0) {
      // Looks like a probability variable — strip _probability suffix if present
      const stem = name.replace(/_probability$/, "").replace(/_/g, " ");
      return `P(${stem})`;
    }
    return name;
  }

  // Convert v1 lineage response → v2 scenario object (matches the shape v2's
  // pages, tree, and analysis already understand).
  function adaptLineageToScenario(lineage, runId, runListEntry) {
    const tree = lineage.tree || {};
    const primaries = tree.children || [];

    // Pick the primary outcome: explicit `primary: true` flag → first float
    const schemaIn = lineage.outcome_schema || [];
    let primarySchema = schemaIn.find(o => o.primary);
    if (!primarySchema) {
      primarySchema = schemaIn.find(o =>
        ["float", "int", "number"].includes((o.type || "").toLowerCase()));
    }
    const primary = primarySchema?.name;
    const range = primarySchema?.range || [0, 1];
    const outcome_schema = schemaIn.map(o =>
      o.name === primary ? { ...o, primary: true, range: o.range || range } : o);

    // Build primary branches
    const branches = primaries.map(node => ({
      label: node.perturbation_label || node.label || node.sim_id,
      child_sim_id: node.sim_id,
      valid: node.valid !== false,
      perturbation: node.perturbation_text || "—",
      mood: node.mood_modifier || "—",
      reasoning: node.classifier_reasoning || node.invalid_reason || "",
      outcomes: node.outcomes || null,
      fork_round: node.fork_round,
      current_round: safe(node.current_round, 0),
      total_rounds: safe(node.total_rounds, 0),
      runner_status: node.runner_status,
    }));

    // Build nested grandchildren — flatten any depth-2 nodes
    const nested = [];
    for (const p of primaries) {
      for (const gc of (p.children || [])) {
        nested.push({
          label: gc.perturbation_label || gc.label || gc.sim_id,
          parent: p.perturbation_label || p.label,
          child_sim_id: gc.sim_id,
          valid: gc.valid !== false,
          fork_round: gc.fork_round,
          perturbation: gc.perturbation_text || "—",
          mood: gc.mood_modifier || "—",
          reasoning: gc.classifier_reasoning || gc.invalid_reason || "",
          outcomes: gc.outcomes || null,
          current_round: safe(gc.current_round, 0),
          total_rounds: safe(gc.total_rounds, 0),
          runner_status: gc.runner_status,
        });
      }
    }

    const validBranches = [...branches, ...nested].filter(b => b.valid);
    const dist = primary ? (lineage.distributions || {})[primary] : null;

    const scenarioName = runListEntry?.scenario || lineage.scenario_name || runId;

    // The root (parent) is its own no-perturbation control. When it ran to
    // horizon and was classified, its outcomes are merged onto the tree node.
    // Surface that as a synthetic branch the tree builder can render as a
    // continuation leaf alongside the perturbed siblings. Also surface the
    // parent's live state (round counter, runner status) regardless of
    // classifier completion — pre-fork and pre-classify the user can still
    // click the root to inspect parent progress.
    const rootLive = tree.sim_id ? {
      sim_id: tree.sim_id,
      current_round: safe(tree.current_round, 0),
      total_rounds: safe(tree.total_rounds, 0),
      runner_status: tree.runner_status,
      status: tree.status,
    } : null;
    const rootOutcomes = tree.outcomes || null;
    const rootBranch = rootOutcomes
      ? {
          label: "no_perturbation",
          child_sim_id: tree.sim_id,
          valid: tree.valid !== false,
          perturbation: "(no perturbation — parent timeline)",
          mood: "—",
          reasoning: tree.classifier_reasoning || tree.invalid_reason || "",
          outcomes: rootOutcomes,
          fork_round: 0,
          current_round: safe(tree.current_round, 0),
          total_rounds: safe(tree.total_rounds, 0),
          runner_status: tree.runner_status,
          isRootContinuation: true,
        }
      : null;

    return {
      id: runId,
      run_id: runId,
      name: scenarioName,
      title: scenarioName.replace(/_/g, " "),
      description: branches.length
        ? `Live ensemble run · ${branches.length} primary branch${branches.length === 1 ? "" : "es"}${nested.length ? ` + ${nested.length} nested grandchildren` : ""}.`
        : "Awaiting first child branches…",
      parent_sim_id: lineage.root_sim_id || tree.sim_id || "—",
      num_branches: branches.length,
      fork_round: branches[0]?.fork_round || 4,
      horizon_rounds: tree.total_rounds || 20,
      platform: "reddit",
      primary,
      primary_label: labelForPrimary(primary, range),
      primary_p: dist?.mean ?? 0,
      primary_ci: dist ? `n=${dist.n} · IQR [${dist.q25.toFixed(2)}, ${dist.q75.toFixed(2)}]` : "",
      ts: runListEntry?.timestamp || tree.created_at?.slice(0, 16).replace("T", " ") || "—",
      n_valid: validBranches.length + (rootBranch && rootBranch.valid ? 1 : 0),
      n_total: branches.length + nested.length + (rootBranch ? 1 : 0),
      branches,
      nested,
      rootBranch,
      rootLive,
      outcome_schema,

      // live state — used by sim-page polling
      phase: lineage.phase || "running",
      manifest_present: !!lineage.manifest_present,
      distributions: lineage.distributions || {},
      lineage_error: lineage.lineage_error,
    };
  }

  // Lightweight summary used by HomePage's "past runs" table.
  function adaptRunsList(runsResp) {
    return (runsResp.runs || []).map(r => ({
      id: r.run_id,
      run_id: r.run_id,
      scenario: (r.scenario || "—").replace(/_/g, " "),
      scenario_id: r.scenario || "",
      n_total: safe(r.n_total, 0),
      n_valid: safe(r.n_valid, 0),
      ts: r.timestamp || "—",
      // primary_p / primary_label aren't in the v1 /api/runs response yet —
      // surface 0 so the home table renders without errors. The detail
      // fetch fills these in.
      primary_p: 0,
      primary_label: "P(headline)",
    }));
  }

  async function jget(url) {
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return await r.json();
  }
  async function jpost(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      throw new Error(data.error || `${r.status} ${r.statusText}`);
    }
    return data;
  }

  window.WF_API = {
    async listRuns() {
      const body = await jget("/api/runs");
      return adaptRunsList(body);
    },

    async getScenario(runId, runListEntry) {
      const body = await jget(`/api/run/${encodeURIComponent(runId)}/lineage`);
      return adaptLineageToScenario(body, runId, runListEntry);
    },

    async startNewRun() {
      const body = await jpost("/api/start", {});
      return body.run_id;
    },

    adaptLineageToScenario,
    adaptRunsList,
    labelForPrimary,
  };

  // Back-compat shim for any code that still reads window.WF_DATA — leave the
  // shape but populate empty so the app doesn't crash if data.js wasn't loaded.
  if (!window.WF_DATA) {
    window.WF_DATA = {
      SCENARIOS: {},
      PAST_RUNS: [],
      SCENARIO: null,
      BRANCHES: [],
      NESTED: [],
      OUTCOME_SCHEMA: [],
    };
  }
})();
