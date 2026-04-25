'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { MultiverseNodeData } from '@/lib/mocks/multiverse';

// Palette for up to 4 universes.
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

export type OverlayMetric = 'dominant_emotion' | 'polarization' | 'mobilization_risk';

interface CompareMetricChartProps {
  nodes: MultiverseNodeData[];
  metric: OverlayMetric;
}

// Generates a deterministic mock time-series for a metric given a node.
// Replace with real tick-artifact data when the hook is available.
function mockSeries(node: MultiverseNodeData, metric: OverlayMetric): number[] {
  // Seed the series from node.divergence_series so each universe looks distinct.
  const base = node.divergence_series;
  return base.map((pt) => {
    switch (metric) {
      case 'dominant_emotion':
        return +(pt.v * 100).toFixed(1);
      case 'polarization':
        return +((1 - pt.v) * 80 + 10).toFixed(1);
      case 'mobilization_risk':
        return +((pt.v * 0.7 + 0.1) * 100).toFixed(1);
    }
  });
}

function buildChartData(nodes: MultiverseNodeData[], metric: OverlayMetric) {
  if (nodes.length === 0) return [];
  const maxLen = Math.max(...nodes.map((n) => n.divergence_series.length));
  return Array.from({ length: maxLen }, (_, tick) => {
    const row: Record<string, number | string> = { tick };
    nodes.forEach((n) => {
      const series = mockSeries(n, metric);
      row[n.id] = series[tick] ?? series[series.length - 1] ?? 0;
    });
    return row;
  });
}

const METRIC_LABEL: Record<OverlayMetric, string> = {
  dominant_emotion: 'Dominant Emotion Score',
  polarization: 'Polarization Index',
  mobilization_risk: 'Mobilization Risk',
};

export function CompareMetricChart({ nodes, metric }: CompareMetricChartProps) {
  const data = React.useMemo(() => buildChartData(nodes, metric), [nodes, metric]);

  if (nodes.length === 0) return null;

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {METRIC_LABEL[metric]} — overlay
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="tick"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Tick', position: 'insideBottom', offset: -2, fontSize: 10 }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            formatter={(v: number | string) =>
              typeof v === 'number' ? [v.toFixed(1), ''] : [v, '']
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {nodes.map((n, i) => (
            <Line
              key={n.id}
              type="monotone"
              dataKey={n.id}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
