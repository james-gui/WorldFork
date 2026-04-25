'use client';

import * as React from 'react';

interface CohortDetailRowProps {
  label: string;
  value: React.ReactNode;
  // Optional 0..1 fill bar; -1..1 supported when symmetric=true.
  bar?: number;
  symmetric?: boolean;
  color?: string;
}

export function CohortDetailRow({
  label,
  value,
  bar,
  symmetric = false,
  color = '#6366f1',
}: CohortDetailRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 min-w-0">
        {bar !== undefined ? (
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
            {symmetric ? (
              <SymmetricBar value={bar} color={color} />
            ) : (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(1, bar)) * 100}%`,
                  backgroundColor: color,
                }}
              />
            )}
          </div>
        ) : null}
      </div>
      <div className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function SymmetricBar({ value, color }: { value: number; color: string }) {
  const v = Math.max(-1, Math.min(1, value));
  const half = 50;
  const widthPct = Math.abs(v) * 50;
  const leftPct = v < 0 ? half - widthPct : half;
  return (
    <>
      <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: '50%' }} />
      <div
        className="h-full"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          backgroundColor: color,
        }}
      />
    </>
  );
}
