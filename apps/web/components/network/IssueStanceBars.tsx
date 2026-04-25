'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
  Tooltip,
} from 'recharts';

interface Props {
  stances: Record<string, number>; // axis -> -1..1
}

const LABELS: Record<string, string> = {
  gig_worker_rights: 'Gig worker rights',
  platform_regulation: 'Platform reg.',
  minimum_wage: 'Min. wage',
  urban_housing: 'Urban housing',
  climate_policy: 'Climate policy',
};

export function IssueStanceBars({ stances }: Props) {
  const data = Object.entries(stances).map(([k, v]) => ({
    issue: LABELS[k] ?? k,
    value: v,
  }));

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis
            type="number"
            domain={[-1, 1]}
            tickCount={5}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="issue"
            tick={{ fontSize: 10, fill: '#374151' }}
            width={100}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="#cbd5e1" />
          <Tooltip
            formatter={(v: number) => v.toFixed(2)}
            contentStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="value" radius={[3, 3, 3, 3]}>
            {data.map((d) => (
              <Cell
                key={d.issue}
                fill={d.value >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
