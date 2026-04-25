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
  CartesianGrid,
} from 'recharts';

interface EmotionTrendsReviewProps {
  data: Array<Record<string, number>>;
  currentTick: number;
  height?: number;
}

const EMOTION_LINES: { key: string; color: string; label: string }[] = [
  { key: 'anger', color: '#ef4444', label: 'Anger' },
  { key: 'hope', color: '#22c55e', label: 'Hope' },
  { key: 'distrust', color: '#f97316', label: 'Distrust' },
  { key: 'sadness', color: '#6366f1', label: 'Sadness' },
  { key: 'joy', color: '#0ea5e9', label: 'Joy' },
];

export function EmotionTrendsReview({
  data,
  currentTick,
  height = 200,
}: EmotionTrendsReviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Emotion Trends</p>
        <span className="text-[10px] text-muted-foreground">5 emotions across ticks</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="tick"
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickFormatter={(v: number) => `T${v}`}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(value: number, name: string) => [value.toFixed(1), name]}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <ReferenceLine
            x={currentTick}
            stroke="#6366f1"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
          />
          {EMOTION_LINES.map(({ key, color, label }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
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
