'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { KpiSparkline } from './KpiSparkline';
import { DominantEmotionDonut } from './DominantEmotionDonut';
import type { SparkPoint } from '@/lib/mocks/dashboard';

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  sparkline?: SparkPoint[];
  sparkColor?: string;
  donut?: { name: string; value: number; color: string }[];
  donutCenterLabel?: string;
}

function KpiCardImpl({
  title,
  value,
  subtitle,
  sparkline,
  sparkColor,
  donut,
  donutCenterLabel,
}: KpiCardProps) {
  return (
    <Card className="p-4 flex flex-col gap-2 min-h-[120px]">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 mt-1">
        <div className="flex flex-col">
          <div className="text-3xl font-bold leading-tight text-foreground">
            {value}
          </div>
          {subtitle ? (
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex items-end shrink-0">
          {donut ? (
            <DominantEmotionDonut
              data={donut}
              centerLabel={donutCenterLabel}
              size={64}
            />
          ) : null}
        </div>
      </div>
      {sparkline && !donut ? (
        <div className="mt-1">
          <KpiSparkline data={sparkline} color={sparkColor} height={36} />
        </div>
      ) : null}
    </Card>
  );
}

export const KpiCard = React.memo(KpiCardImpl);
