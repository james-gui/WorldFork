'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface SparklinePoint {
  v: number;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  spark?: SparklinePoint[];
  loading?: boolean;
  color?: string;
}

function KpiCard({ label, value, delta, positive, spark, loading, color = '#6366f1' }: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-7 w-16 mb-2" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {delta && (
          <p className={cn('text-xs mt-0.5', positive ? 'text-green-600' : 'text-red-500')}>
            {delta}
          </p>
        )}
        {spark && spark.length > 0 && (
          <div className="mt-2 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={() => null}
                  cursor={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MOCK_SPARK = Array.from({ length: 20 }, (_, i) => ({
  v: Math.round(5 + Math.random() * 15 + Math.sin(i / 3) * 5),
}));

const MOCK_FAIL_SPARK = Array.from({ length: 20 }, (_, i) => ({
  v: Math.round(Math.abs(Math.sin(i / 2) * 3)),
}));

interface JobsKpiStripProps {
  loading?: boolean;
}

export function JobsKpiStrip({ loading }: JobsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard
        label="Tasks in flight"
        value="24"
        delta="+3 from avg"
        positive={false}
        spark={MOCK_SPARK}
        loading={loading}
        color="#6366f1"
      />
      <KpiCard
        label="Active workers"
        value="8"
        delta="of 12 total"
        positive={true}
        spark={MOCK_SPARK}
        loading={loading}
        color="#22c55e"
      />
      <KpiCard
        label="Avg latency"
        value="1.84s"
        delta="-12% vs 1h"
        positive={true}
        spark={MOCK_SPARK}
        loading={loading}
        color="#0ea5e9"
      />
      <KpiCard
        label="Failed (24h)"
        value="32"
        delta="+5 since yesterday"
        positive={false}
        spark={MOCK_FAIL_SPARK}
        loading={loading}
        color="#ef4444"
      />
      <KpiCard
        label="Retry count"
        value="11"
        delta="3 currently active"
        positive={false}
        spark={MOCK_FAIL_SPARK}
        loading={loading}
        color="#f97316"
      />
      <KpiCard
        label="Throughput"
        value="1,842/min"
        delta="+8% vs 1h"
        positive={true}
        spark={MOCK_SPARK}
        loading={loading}
        color="#8b5cf6"
      />
    </div>
  );
}
