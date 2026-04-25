'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { PolicyControlRow } from './PolicyControlRow';
import type { BranchPolicyFormValues } from './schema';

const CONTROL_DEFS: Array<{
  key: keyof BranchPolicyFormValues['controls'];
  label: string;
  description?: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
}> = [
  {
    key: 'branchTriggerThreshold',
    label: 'Branch Trigger Threshold',
    description: 'Min divergence required to spawn a branch.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'cooldownPeriod',
    label: 'Cooldown Period',
    description: 'Minimum ticks between branches per universe.',
    min: 0,
    max: 20,
    step: 1,
    unit: 'ticks',
  },
  {
    key: 'stagnationCleanup',
    label: 'Stagnation Cleanup',
    description: 'Auto-prune low-value branches.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'divergenceDetectionThreshold',
    label: 'Divergence Detection threshold',
    description: 'Min metric delta to count as divergent.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'coolPeriod',
    label: 'Cool Period',
    description: 'Decay window for repeated triggers.',
    min: 0,
    max: 30,
    step: 1,
    unit: 'ticks',
  },
  {
    key: 'storageLimit',
    label: 'Storage Limit',
    description: 'Max total active universes.',
    min: 0,
    max: 200,
    step: 1,
  },
  {
    key: 'perSandboxLimit',
    label: 'Per-Sandbox Limit',
    description: 'Max branches per sandbox per tick.',
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: 'storageMultiplier',
    label: 'Storage Multiplier',
    description: 'Scale factor on persisted artifacts.',
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  {
    key: 'heatMode',
    label: 'Heat Mode',
    description: 'Aggressiveness of branching when active.',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'tradeRoutes',
    label: 'Trade Routes (decay)',
    description: 'Decay rate for cross-universe coupling.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'autoRouting',
    label: 'Auto Routing',
    description: 'Auto-route branches to lower-latency providers.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'eclipseReduction',
    label: 'Eclipse Reduction',
    description: 'Suppress redundant subtrees.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'killThreshold',
    label: 'Kill threshold',
    description: 'Score below which branches are killed.',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: 'lateMode',
    label: 'Late Mode',
    description: 'Tighten policy for late-stage branches.',
    min: 0,
    max: 1,
    step: 0.01,
  },
];

export function BranchingControlsList() {
  const form = useFormContext<BranchPolicyFormValues>();
  const controls = useWatch({ control: form.control, name: 'controls' });
  const enabled = useWatch({ control: form.control, name: 'enabled' });

  return (
    <div className="space-y-2">
      {CONTROL_DEFS.map((def) => (
        <PolicyControlRow
          key={def.key}
          label={def.label}
          description={def.description}
          min={def.min}
          max={def.max}
          step={def.step}
          unit={def.unit}
          formatValue={def.formatValue}
          value={controls?.[def.key] ?? def.min}
          enabled={enabled?.[def.key] ?? true}
          onValueChange={(v) =>
            form.setValue(`controls.${def.key}`, v, { shouldDirty: true })
          }
          onEnabledChange={(v) =>
            form.setValue(`enabled.${def.key}`, v, { shouldDirty: true })
          }
        />
      ))}
    </div>
  );
}
