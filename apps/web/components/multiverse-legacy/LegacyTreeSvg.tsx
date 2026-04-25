'use client';

import * as React from 'react';

export interface WorldNode {
  id: string;
  label: string;
  color: string;
  status: 'Active' | 'Candidate' | 'Frozen' | 'Killed';
  tickLabel: string;
  // midpoint nodes along the curve (0..1 param)
  midNodes?: { t: number; status: 'Active' | 'Candidate' | 'Frozen' | 'Killed' }[];
}

const STATUS_COLOR: Record<string, string> = {
  Active: '#22c55e',
  Candidate: '#facc15',
  Frozen: '#60a5fa',
  Killed: '#f87171',
};

// Build a cubic Bezier path from start (x0,y0) to end (x1,y1)
function cubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string {
  const cx = x0 + (x1 - x0) * 0.4;
  return `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
}

// Evaluate point on cubic Bezier at parameter t
function evalBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number
): { x: number; y: number } {
  const cx = x0 + (x1 - x0) * 0.4;
  // P(t) for C x0,y0 -> cx,y0 -> cx,y1 -> x1,y1
  const mt = 1 - t;
  const x =
    mt * mt * mt * x0 +
    3 * mt * mt * t * cx +
    3 * mt * t * t * cx +
    t * t * t * x1;
  const y =
    mt * mt * mt * y0 +
    3 * mt * mt * t * y0 +
    3 * mt * t * t * y1 +
    t * t * t * y1;
  return { x, y };
}

interface LegacyTreeSvgProps {
  worlds: WorldNode[];
  selectedId?: string;
  onSelectWorld: (id: string) => void;
  zoom: number; // percent, 50–200
}

const SVG_W = 900;
const SVG_H = 500;
const START_X = 80;
const START_Y = SVG_H / 2;
const END_X = 780;
const WORLD_SPREAD = 80; // vertical spacing between worlds

export function LegacyTreeSvg({
  worlds,
  selectedId,
  onSelectWorld,
  zoom,
}: LegacyTreeSvgProps) {
  const scale = zoom / 100;
  const totalH = Math.max(worlds.length * WORLD_SPREAD, 300);
  const midY = totalH / 2;

  return (
    <div className="w-full overflow-auto bg-card rounded-xl border p-2">
      <svg
        width={SVG_W * scale}
        height={(totalH + 80) * scale}
        viewBox={`0 0 ${SVG_W} ${totalH + 80}`}
        className="select-none"
      >
        {/* Start node */}
        <circle cx={START_X} cy={midY + 40} r={20} fill="#6366f1" />
        <text
          x={START_X}
          y={midY + 44}
          textAnchor="middle"
          fontSize={10}
          fill="white"
          fontWeight="bold"
        >
          Start
        </text>

        {/* Tick ruler labels at top */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((tick) => {
          const tx = START_X + ((END_X - START_X) / 8) * tick;
          return (
            <g key={tick}>
              <line
                x1={tx}
                y1={20}
                x2={tx}
                y2={totalH + 60}
                stroke="#e5e7eb"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text x={tx} y={16} textAnchor="middle" fontSize={9} fill="#9ca3af">
                T-{tick}
              </text>
            </g>
          );
        })}

        {/* World curves */}
        {worlds.map((world, i) => {
          const worldY = 40 + i * WORLD_SPREAD + WORLD_SPREAD / 2;
          const isSelected = world.id === selectedId;
          const path = cubicBezier(START_X, midY + 40, END_X, worldY);

          return (
            <g
              key={world.id}
              className="cursor-pointer"
              onClick={() => onSelectWorld(world.id)}
            >
              {/* Wider transparent hit target */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
              />
              {/* Visible path */}
              <path
                d={path}
                fill="none"
                stroke={world.color}
                strokeWidth={isSelected ? 3.5 : 2}
                strokeOpacity={isSelected ? 1 : 0.7}
              />

              {/* Mid-curve status nodes */}
              {(world.midNodes ?? []).map((mn, mi) => {
                const pt = evalBezier(START_X, midY + 40, END_X, worldY, mn.t);
                return (
                  <circle
                    key={mi}
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill={STATUS_COLOR[mn.status]}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* End label */}
              <rect
                x={END_X + 6}
                y={worldY - 12}
                width={80}
                height={22}
                rx={4}
                fill={isSelected ? world.color : '#f3f4f6'}
                opacity={0.9}
              />
              <text
                x={END_X + 46}
                y={worldY + 4}
                textAnchor="middle"
                fontSize={10}
                fill={isSelected ? 'white' : '#374151'}
                fontWeight={isSelected ? 'bold' : 'normal'}
              >
                {world.label}
              </text>

              {/* End node dot */}
              <circle
                cx={END_X}
                cy={worldY}
                r={7}
                fill={STATUS_COLOR[world.status]}
                stroke="white"
                strokeWidth={1.5}
              />

              {/* Tick label below end node */}
              <text
                x={END_X}
                y={worldY + 20}
                textAnchor="middle"
                fontSize={8}
                fill="#9ca3af"
              >
                {world.tickLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
