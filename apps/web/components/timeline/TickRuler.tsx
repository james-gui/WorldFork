'use client';

import * as React from 'react';

interface TickRulerProps {
  ticks: number; // total ticks
  currentTick: number;
  width?: number;
  height?: number;
}

export function TickRuler({ ticks, currentTick, width = 900, height = 40 }: TickRulerProps) {
  const paddingLeft = 100; // lane label width
  const paddingRight = 20;
  const rulerW = width - paddingLeft - paddingRight;
  const step = rulerW / Math.max(ticks - 1, 1);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {/* Base line */}
      <line
        x1={paddingLeft}
        y1={height - 10}
        x2={width - paddingRight}
        y2={height - 10}
        stroke="#d1d5db"
        strokeWidth={1.5}
      />

      {Array.from({ length: ticks }, (_, i) => {
        const tick = i + 1;
        const x = paddingLeft + i * step;
        const isCurrent = tick === currentTick;
        return (
          <g key={tick}>
            <line
              x1={x}
              y1={height - 16}
              x2={x}
              y2={height - 4}
              stroke={isCurrent ? '#6366f1' : '#9ca3af'}
              strokeWidth={isCurrent ? 2 : 1}
            />
            <text
              x={x}
              y={height - 20}
              textAnchor="middle"
              fontSize={9}
              fill={isCurrent ? '#6366f1' : '#6b7280'}
              fontWeight={isCurrent ? 'bold' : 'normal'}
            >
              T{tick}
            </text>
          </g>
        );
      })}

      {/* Current tick indicator */}
      {(() => {
        const x = paddingLeft + (currentTick - 1) * step;
        return (
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={height - 4}
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
        );
      })()}
    </svg>
  );
}
