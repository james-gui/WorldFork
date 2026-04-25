'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from 'recharts';
import { useLogs } from '@/lib/api/logs';

function buildSparkData(logs: { created_at: string }[]) {
  const now = Date.now();
  const buckets = Array.from({ length: 60 }, (_, i) => {
    const bucketStart = now - (59 - i) * 60_000;
    return {
      start: bucketStart,
      t: new Date(bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rpm: 0,
    };
  });

  for (const log of logs) {
    const createdAt = new Date(log.created_at).getTime();
    if (Number.isNaN(createdAt) || createdAt < now - 60 * 60_000 || createdAt > now) continue;
    const index = Math.min(59, Math.max(0, Math.floor((createdAt - (now - 60 * 60_000)) / 60_000)));
    buckets[index].rpm += 1;
  }

  return buckets.map(({ t, rpm }) => ({ t, rpm }));
}

export function RoutingUsageCard() {
  const { data: logs = [] } = useLogs({ limit: 1000 });

  const sparkData = React.useMemo(() => buildSparkData(logs), [logs]);
  const average = React.useMemo(() => {
    const total = sparkData.reduce((sum, point) => sum + point.rpm, 0);
    return total / 60;
  }, [sparkData]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Routing Usage Summary</CardTitle>
        <p className="text-xs text-muted-foreground">Requests/min over last hour</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-3 mb-2">
          <span className="text-2xl font-bold tabular-nums">{average.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground mb-1">req / min avg</span>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" hide />
            <Tooltip
              contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
              labelStyle={{ fontSize: '10px' }}
            />
            <Area
              type="monotone"
              dataKey="rpm"
              stroke="hsl(var(--brand-600, 221 83% 53%))"
              fill="hsl(var(--brand-600, 221 83% 53%) / 0.15)"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
