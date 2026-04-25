'use client';

import * as React from 'react';

interface Props {
  values: {
    economic: number; // -1..1
    social: number;
    institutional: number;
    cultural: number;
    international: number;
  };
  size?: number;
}

const AXES: { key: keyof Props['values']; label: string }[] = [
  { key: 'economic', label: 'Econ' },
  { key: 'social', label: 'Social' },
  { key: 'institutional', label: 'Inst' },
  { key: 'cultural', label: 'Cult' },
  { key: 'international', label: 'Intl' },
];

/**
 * Tiny radial / radar chart drawn with pure SVG (no extra deps).
 * Each axis is mapped from -1..1 to 0..1 along its radial spoke.
 */
export function IdeologyAxesRadial({ values, size = 180 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;

  const points = AXES.map((a, i) => {
    const t = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
    const v = (values[a.key] + 1) / 2; // -1..1 -> 0..1
    return {
      label: a.label,
      x: cx + Math.cos(t) * r * v,
      y: cy + Math.sin(t) * r * v,
      lx: cx + Math.cos(t) * (r + 10),
      ly: cy + Math.sin(t) * (r + 10),
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Concentric grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} className="block mx-auto">
      {rings.map((f) => (
        <polygon
          key={f}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
          points={AXES.map((_, i) => {
            const t = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
            return `${cx + Math.cos(t) * r * f},${cy + Math.sin(t) * r * f}`;
          }).join(' ')}
        />
      ))}
      {AXES.map((_, i) => {
        const t = (i / AXES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(t) * r}
            y2={cy + Math.sin(t) * r}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={polygon}
        fill="rgba(99, 102, 241, 0.25)"
        stroke="#6366f1"
        strokeWidth={1.5}
      />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={2.5} fill="#6366f1" />
      ))}
      {points.map((p) => (
        <text
          key={`l-${p.label}`}
          x={p.lx}
          y={p.ly}
          fontSize={10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
