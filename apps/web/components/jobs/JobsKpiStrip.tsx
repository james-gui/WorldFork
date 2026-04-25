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

interface JobsKpiStripProps {
  loading?: boolean;
  metrics?: {
    inFlight: number;
    activeQueues: number;
    queued: number;
    failed: number;
    retries: number;
    total: number;
  };
}

export function JobsKpiStrip({ loading, metrics }: JobsKpiStripProps) {
  const data = metrics ?? {
    inFlight: 0,
    activeQueues: 0,
    queued: 0,
    failed: 0,
    retries: 0,
    total: 0,
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard
        label="Tasks in flight"
        value={data.inFlight}
        loading={loading}
        color="#6366f1"
      />
      <KpiCard
        label="Active queues"
        value={data.activeQueues}
        positive={true}
        loading={loading}
        color="#22c55e"
      />
      <KpiCard
        label="Queued"
        value={data.queued}
        positive={true}
        loading={loading}
        color="#0ea5e9"
      />
      <KpiCard
        label="Failed"
        value={data.failed}
        positive={false}
        loading={loading}
        color="#ef4444"
      />
      <KpiCard
        label="Retry count"
        value={data.retries}
        positive={false}
        loading={loading}
        color="#f97316"
      />
      <KpiCard
        label="Total rows"
        value={data.total}
        positive={true}
        loading={loading}
        color="#8b5cf6"
      />
    </div>
  );
}
