'use client';

import * as React from 'react';
import type { NetworkNodeAttrs } from '@/lib/network/types';

interface Props {
  attrs: NetworkNodeAttrs;
  x: number;
  y: number;
}

export function NodeHoverCard({ attrs, x, y }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] min-w-[200px] rounded-lg border bg-popover p-3 shadow-md text-xs"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="size-2.5 rounded-full"
          style={{ background: attrs.color }}
        />
        <span className="font-semibold truncate">{attrs.label}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <dt className="text-muted-foreground">Population</dt>
        <dd className="tabular-nums text-right">
          {attrs.representedPopulation.toLocaleString()}
        </dd>
        <dt className="text-muted-foreground">Trust</dt>
        <dd className="tabular-nums text-right">{attrs.trust.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Mobilization</dt>
        <dd className="tabular-nums text-right">
          {attrs.mobilizationCapacity.toFixed(2)}
        </dd>
        <dt className="text-muted-foreground">Stance</dt>
        <dd className="tabular-nums text-right">
          {attrs.cohortStance.toFixed(2)}
        </dd>
      </dl>
    </div>
  );
}
