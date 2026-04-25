'use client';

import * as React from 'react';

export type LaneKind = 'posts' | 'events' | 'cohorts' | 'god';

const KIND_COLOR: Record<LaneKind, string> = {
  posts: '#6366f1',
  events: '#f59e0b',
  cohorts: '#22c55e',
  god: '#ec4899',
};

const KIND_SHAPE: Record<LaneKind, 'circle' | 'diamond' | 'square' | 'star'> = {
  posts: 'circle',
  events: 'diamond',
  cohorts: 'square',
  god: 'star',
};

export interface TimelineEvent {
  id: string;
  tick: number;
  kind: LaneKind;
  label: string;
  detail: string;
}

interface EventMarkerProps {
  event: TimelineEvent;
  cx: number;
  cy: number;
  r?: number;
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function renderShape(
  shape: 'circle' | 'diamond' | 'square' | 'star',
  cx: number,
  cy: number,
  r: number,
  color: string,
  stroke: string
): React.ReactNode {
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r} fill={color} stroke={stroke} strokeWidth={1.5} />;
    case 'diamond': {
      const d = `M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`;
      return <path d={d} fill={color} stroke={stroke} strokeWidth={1.5} />;
    }
    case 'square': {
      return (
        <rect
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          rx={2}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    }
    case 'star': {
      // 5-point star
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.4;
        pts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
      return (
        <polygon
          points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
    }
  }
}

export function EventMarker({
  event,
  cx,
  cy,
  r = 7,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: EventMarkerProps) {
  const color = KIND_COLOR[event.kind];
  const shape = KIND_SHAPE[event.kind];
  const effectiveR = isHovered ? r + 2 : r;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Invisible larger hit target */}
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      {renderShape(shape, cx, cy, effectiveR, color, isHovered ? 'white' : 'rgba(255,255,255,0.8)')}
    </g>
  );
}
