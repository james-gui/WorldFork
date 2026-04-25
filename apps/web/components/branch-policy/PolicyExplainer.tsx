'use client';

import * as React from 'react';
import type { BranchPolicyFormValues } from './schema';

interface PolicyExplainerProps {
  values: BranchPolicyFormValues;
}

function buildExplainer(v: BranchPolicyFormValues): string {
  const c = v.controls;
  return `# Policy Explainer

A new branch is spawned at tick T when:
  divergence_score(T) >= ${c.branchTriggerThreshold.toFixed(2)}    # Branch Trigger Threshold
  AND ticks_since_last_branch >= ${c.cooldownPeriod}               # Cooldown Period
  AND active_universes < ${c.storageLimit}                          # Storage Limit
  AND branches_in_tick < ${c.perSandboxLimit}                       # Per-Sandbox Limit

Existing branches are pruned/killed when:
  value_score < ${c.killThreshold.toFixed(2)}                       # Kill threshold
  OR redundancy_score > ${(1 - c.eclipseReduction).toFixed(2)}      # Eclipse Reduction

Stagnation cleanup releases storage at intensity ${c.stagnationCleanup.toFixed(
    2
  )}; trade routes between siblings decay at ${c.tradeRoutes.toFixed(2)}/tick.

Heat Mode (${c.heatMode.toFixed(
    2
  )}) scales the trigger budget upward when system-wide volatility is high; Late Mode (${c.lateMode.toFixed(
    2
  )}) tightens the budget late in a run to favor convergence.
`;
}

export function PolicyExplainer({ values }: PolicyExplainerProps) {
  const text = React.useMemo(() => buildExplainer(values), [values]);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Policy Explainer</p>
        <p className="text-[10px] text-muted-foreground">
          Plain-English description of how rules combine
        </p>
      </div>
      <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap p-3 bg-slate-50 dark:bg-slate-900/40 text-foreground/90 overflow-x-auto">
        {text}
      </pre>
    </div>
  );
}
