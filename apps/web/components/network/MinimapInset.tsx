'use client';

import * as React from 'react';
import type { NetworkDataset } from '@/lib/network/seededDataset';

interface Props {
  data: NetworkDataset;
}

const W = 160;
const H = 100;

/**
 * Decorative minimap — pure SVG snapshot of the node positions.
 * Avoids spinning up a second Sigma instance; cheap and visually consistent.
 */
export function MinimapInset({ data }: Props) {
  const { vbX, vbY, vbW, vbH } = React.useMemo(() => {
    if (!data.nodes.length) return { vbX: 0, vbY: 0, vbW: 1, vbH: 1 };
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of data.nodes) {
      if (n.attrs.x < minX) minX = n.attrs.x;
      if (n.attrs.x > maxX) maxX = n.attrs.x;
      if (n.attrs.y < minY) minY = n.attrs.y;
      if (n.attrs.y > maxY) maxY = n.attrs.y;
    }
    const padX = (maxX - minX) * 0.05 + 1;
    const padY = (maxY - minY) * 0.05 + 1;
    return {
      vbX: minX - padX,
      vbY: minY - padY,
      vbW: maxX - minX + padX * 2,
      vbH: maxY - minY + padY * 2,
    };
  }, [data]);

  return (
    <div className="rounded-md border bg-white/85 backdrop-blur-sm shadow-sm overflow-hidden">
      <svg
        width={W}
        height={H}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {data.nodes.map((n) => (
          <circle
            key={n.id}
            cx={n.attrs.x}
            cy={n.attrs.y}
            r={Math.max(2, n.attrs.size * 0.6)}
            fill={n.attrs.color}
            opacity={0.85}
          />
        ))}
        {/* viewport rectangle (decorative) */}
        <rect
          x={vbX + vbW * 0.3}
          y={vbY + vbH * 0.3}
          width={vbW * 0.4}
          height={vbH * 0.4}
          fill="none"
          stroke="#6366f1"
          strokeWidth={vbW * 0.005}
          opacity={0.7}
        />
      </svg>
    </div>
  );
}
