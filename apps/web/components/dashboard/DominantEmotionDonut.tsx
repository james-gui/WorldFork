'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface DominantEmotionDonutProps {
  data: DonutSlice[];
  size?: number;
  centerLabel?: string;
}

function DominantEmotionDonutImpl({
  data,
  size = 80,
  centerLabel,
}: DominantEmotionDonutProps) {
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-label="Emotion distribution"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={size * 0.32}
            outerRadius={size * 0.48}
            paddingAngle={1}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-semibold text-foreground">
            {centerLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export const DominantEmotionDonut = React.memo(DominantEmotionDonutImpl);
