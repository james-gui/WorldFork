'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  GitBranch,
  Layers,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import type { MultiverseTreePayload } from '@/lib/mocks/multiverse';

interface KpiStripProps {
  kpis: MultiverseTreePayload['kpis'];
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  children?: React.ReactNode;
}

function MetricCard({ label, value, subtitle, Icon, accent, children }: MetricProps) {
  return (
    <Card className="p-4 flex flex-col gap-2 min-h-[112px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className="grid h-7 w-7 place-items-center rounded-md"
          style={{ background: `${accent}1A`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="text-3xl font-bold leading-tight tabular-nums">{value}</div>
      {subtitle ? (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      ) : null}
      {children}
    </Card>
  );
}

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        label="Active Universes"
        value={kpis.activeUniverses}
        subtitle="Branches running this tick"
        Icon={Activity}
        accent="#10b981"
      />
      <MetricCard
        label="Total Branches"
        value={kpis.totalBranches}
        subtitle="Across the multiverse"
        Icon={GitBranch}
        accent="#6366f1"
      />
      <MetricCard
        label="Max Depth"
        value={kpis.maxDepth}
        subtitle="Deepest lineage observed"
        Icon={Layers}
        accent="#8b5cf6"
      />
      <MetricCard
        label="Branch Budget"
        value={`${kpis.branchBudgetPct}%`}
        subtitle={`${kpis.branchBudgetUsed} / ${kpis.branchBudgetLimit} branches`}
        Icon={Gauge}
        accent="#f59e0b"
      >
        <Progress value={Math.min(100, kpis.branchBudgetPct)} className="h-1.5" />
      </MetricCard>
      <MetricCard
        label="Active Branches/Tick"
        value={kpis.activeBranchesPerTick.toFixed(2)}
        subtitle="Average over recent window"
        Icon={TrendingUp}
        accent="#0ea5e9"
      />
    </div>
  );
}
