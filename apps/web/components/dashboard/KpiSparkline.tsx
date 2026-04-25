'use client';

import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import type { SparkPoint } from '@/lib/dashboard/types';

interface KpiSparklineProps {
  data: SparkPoint[];
  color?: string;
  height?: number;
  ariaLabel?: string;
}

function KpiSparklineImpl({
  data,
  color = '#6366f1',
  height = 48,
  ariaLabel,
}: KpiSparklineProps) {
  const id = React.useId();
  return (
    <div
      className="w-full"
      style={{ height }}
      aria-label={ariaLabel ?? 'sparkline'}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const KpiSparkline = React.memo(KpiSparklineImpl);
