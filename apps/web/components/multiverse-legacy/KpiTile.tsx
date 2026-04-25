'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';

interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
}

export function KpiTile({ label, value, delta, positive }: KpiTileProps) {
  return (
    <Card className="p-3 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {delta && (
        <span
          className={`text-xs font-medium ${
            positive ? 'text-emerald-600' : 'text-rose-500'
          }`}
        >
          {delta}
        </span>
      )}
    </Card>
  );
}
