'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';

interface KeyMetric {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
}

interface KeyMetricsRowProps {
  metrics: {
    trust: number;
    polarization: number;
    volatility: number;
    trustEngagement: number;
    mobilization: number;
  };
}

const TONE_CLASS: Record<NonNullable<KeyMetric['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-red-600',
};

function MetricTile({ label, value, hint, tone = 'default' }: KeyMetric) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className={cn('text-2xl font-semibold tabular-nums mt-1', TONE_CLASS[tone])}>
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-1 truncate">{hint}</p>
      )}
    </div>
  );
}

export function KeyMetricsRow({ metrics }: KeyMetricsRowProps) {
  const items: KeyMetric[] = [
    { label: 'Trust', value: metrics.trust.toFixed(2), hint: 'Network avg', tone: 'positive' },
    { label: 'Polarization', value: metrics.polarization.toFixed(2), hint: 'Spread', tone: 'warning' },
    { label: 'Volatility', value: metrics.volatility.toFixed(2), hint: 'Tick variance' },
    {
      label: 'Trust Engagement',
      value: formatNumber(metrics.trustEngagement),
      hint: 'Total interactions',
    },
    {
      label: 'Mobilization',
      value: metrics.mobilization,
      hint: 'Active threads',
      tone: 'critical',
    },
  ];

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Key Metrics
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map((m) => (
          <MetricTile key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}
