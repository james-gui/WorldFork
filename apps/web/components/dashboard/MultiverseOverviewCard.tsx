'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { EventQueueMini } from './EventQueueMini';
import type { DashboardOverviewData } from '@/lib/dashboard/types';

interface MultiverseOverviewCardProps {
  data: DashboardOverviewData;
}

export function MultiverseOverviewCard({ data }: MultiverseOverviewCardProps) {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Multiverse Overview
            </h3>
            <span className="text-xs text-muted-foreground">live</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Universes" value={data.totalUniverses} />
            <Stat
              label="Dom. emotion"
              value={data.multiverseDominant}
              accent
            />
            <Stat
              label="Branches / tick"
              value={data.branchesPerTick.toFixed(1)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Aggregated across all active universes. Updated each tick.
          </p>
        </div>
        <div className="lg:border-l lg:border-border lg:pl-6">
          <EventQueueMini events={data.events} max={5} />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-lg font-semibold tabular-nums ${accent ? 'text-brand-600 dark:text-brand-300' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}
