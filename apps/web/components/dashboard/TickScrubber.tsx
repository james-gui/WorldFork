'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';

interface TickScrubberProps {
  totalTicks: number;
  currentTick: number;
  onChange: (tick: number) => void;
}

export function TickScrubber({
  totalTicks,
  currentTick,
  onChange,
}: TickScrubberProps) {
  const safeMax = Math.max(0, totalTicks - 1);
  const value = Math.max(0, Math.min(safeMax, currentTick));
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
        Simulation Time
      </span>
      <div className="flex-1 min-w-0 relative">
        <Slider
          value={[value]}
          min={0}
          max={safeMax}
          step={1}
          onValueChange={(v) => onChange(v[0] ?? 0)}
          aria-label="Tick scrubber"
        />
        {/* Tick marks */}
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-1">
          {Array.from({ length: Math.min(11, totalTicks) }).map((_, i) => (
            <div key={i} className="h-1 w-px bg-border" />
          ))}
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {value} / {safeMax}
      </span>
    </div>
  );
}
