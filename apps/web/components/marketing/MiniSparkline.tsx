'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from 'recharts';

interface MiniSparklineProps {
  data: { v: number }[];
  color?: string;
  label?: string;
}

export function MiniSparkline({
  data,
  color = '#6366f1',
  label,
}: MiniSparklineProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      )}
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              formatter={(val: number) => [val.toFixed(1), '']}
              labelFormatter={() => ''}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
