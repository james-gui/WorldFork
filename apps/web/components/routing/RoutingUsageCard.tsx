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

// Stub data — last hour of requests/min
function generateSparkData() {
  const now = Date.now();
  return Array.from({ length: 60 }, (_, i) => ({
    t: new Date(now - (59 - i) * 60_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rpm: Math.floor(Math.random() * 120 + 20),
  }));
}

const SPARK_DATA = generateSparkData();

export function RoutingUsageCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Routing Usage Summary</CardTitle>
        <p className="text-xs text-muted-foreground">Requests/min over last hour</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-3 mb-2">
          <span className="text-2xl font-bold tabular-nums">2,541</span>
          <span className="text-xs text-muted-foreground mb-1">req / min avg</span>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={SPARK_DATA} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
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
