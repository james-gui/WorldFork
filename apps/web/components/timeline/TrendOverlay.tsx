'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

interface TrendDataPoint {
  tick: number;
  anger: number;
  hope: number;
  distrust: number;
  sadness: number;
}

interface TrendOverlayProps {
  data: TrendDataPoint[];
  currentTick: number;
}

const EMOTION_LINES: { key: keyof Omit<TrendDataPoint, 'tick'>; color: string }[] = [
  { key: 'anger', color: '#ef4444' },
  { key: 'hope', color: '#22c55e' },
  { key: 'distrust', color: '#f97316' },
  { key: 'sadness', color: '#6366f1' },
];

export function TrendOverlay({ data, currentTick }: TrendOverlayProps) {
  return (
    <div className="w-full rounded-xl border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Emotion Trends
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="tick"
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickFormatter={(v: number) => `T${v}`}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickCount={3}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(value: number, name: string) => [value.toFixed(1), name]}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: 10 }}
          />
          <ReferenceLine
            x={currentTick}
            stroke="#6366f1"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
          />
          {EMOTION_LINES.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
