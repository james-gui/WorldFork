'use client';

import * as React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BranchPolicyFormValues } from './schema';

interface ValidationPanelProps {
  values: BranchPolicyFormValues;
}

interface Rule {
  label: string;
  pass: boolean;
}

function evaluateRules(values: BranchPolicyFormValues): Rule[] {
  const c = values.controls;
  return [
    {
      label: 'Branch threshold ≤ Cooldown period',
      pass: c.branchTriggerThreshold * 10 <= c.cooldownPeriod,
    },
    {
      label: 'Stagnation Cleanup ≤ Storage Limit',
      pass: c.stagnationCleanup * 100 <= c.storageLimit,
    },
    {
      label: 'Branch threshold ≥ Divergence Detection threshold',
      pass: c.branchTriggerThreshold >= c.divergenceDetectionThreshold,
    },
    {
      label: 'Per-Sandbox Limit ≤ Storage Limit',
      pass: c.perSandboxLimit <= c.storageLimit,
    },
    {
      label: 'Kill threshold < Branch trigger threshold',
      pass: c.killThreshold < c.branchTriggerThreshold,
    },
  ];
}

export function ValidationPanel({ values }: ValidationPanelProps) {
  const rules = React.useMemo(() => evaluateRules(values), [values]);
  const allPass = rules.every((r) => r.pass);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className={cn(
          'px-3 py-2 border-b border-border flex items-center justify-between',
          allPass ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-amber-50 dark:bg-amber-950/20'
        )}
      >
        <p className="text-xs font-semibold">Validation</p>
        <span
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full',
            allPass
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          )}
        >
          {allPass ? 'All passing' : `${rules.filter((r) => !r.pass).length} issue(s)`}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rules.map((r, i) => (
          <li key={i} className="px-3 py-2 flex items-center gap-2 text-xs">
            {r.pass ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className={cn(r.pass ? 'text-foreground' : 'text-red-700')}>
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
