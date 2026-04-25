'use client';

import * as React from 'react';

interface PolicyOutcomeCardProps {
  branchesPerTick: number;
  estimatedDepth: number;
  estimatedCost: number;
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function PolicyOutcomeCard({
  branchesPerTick,
  estimatedDepth,
  estimatedCost,
}: PolicyOutcomeCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Policy Outcome</p>
        <p className="text-[10px] text-muted-foreground">
          Estimated impact under current settings
        </p>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2">
        <Tile
          label="Branches / tick"
          value={branchesPerTick.toFixed(1)}
          hint="Avg estimate"
        />
        <Tile label="Depth" value={String(estimatedDepth)} hint="Max projected" />
        <Tile
          label="Est. cost"
          value={`$${estimatedCost.toFixed(2)}`}
          hint="Per run"
        />
      </div>
    </div>
  );
}
