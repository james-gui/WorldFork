'use client';

import * as React from 'react';
import { EventMarker, TimelineEvent, LaneKind } from './EventMarker';

const LANE_DEFS: { kind: LaneKind; label: string }[] = [
  { kind: 'posts', label: 'Posts / Press' },
  { kind: 'events', label: 'Events' },
  { kind: 'cohorts', label: 'Cohort Shifts' },
  { kind: 'god', label: 'God-Agent Actions' },
];

const LANE_H = 48;
const PADDING_LEFT = 120;
const PADDING_RIGHT = 20;
const PADDING_TOP = 8;

interface SwimlanesProps {
  events: TimelineEvent[];
  ticks: number;
  currentTick: number;
  onEventClick: (event: TimelineEvent) => void;
}

interface TooltipState {
  event: TimelineEvent;
  x: number;
  y: number;
}

export function Swimlanes({ events, ticks, currentTick, onEventClick }: SwimlanesProps) {
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const svgW = 900;
  const svgH = PADDING_TOP + LANE_DEFS.length * LANE_H + PADDING_TOP;
  const rulerW = svgW - PADDING_LEFT - PADDING_RIGHT;
  const step = rulerW / Math.max(ticks - 1, 1);

  function tickX(tick: number) {
    return PADDING_LEFT + (tick - 1) * step;
  }

  function laneY(laneIndex: number) {
    return PADDING_TOP + laneIndex * LANE_H + LANE_H / 2;
  }

  function handleMouseEnter(evt: TimelineEvent, svgX: number, svgY: number) {
    setTooltip({ event: evt, x: svgX, y: svgY });
  }

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="overflow-visible"
      >
        {/* Lane backgrounds + labels */}
        {LANE_DEFS.map((lane, i) => (
          <g key={lane.kind}>
            <rect
              x={0}
              y={PADDING_TOP + i * LANE_H}
              width={svgW}
              height={LANE_H}
              fill={i % 2 === 0 ? '#f9fafb' : '#f3f4f6'}
              className="dark:fill-muted/30"
            />
            <text
              x={PADDING_LEFT - 8}
              y={laneY(i) + 4}
              textAnchor="end"
              fontSize={10}
              fill="#6b7280"
              fontWeight="500"
            >
              {lane.label}
            </text>
            {/* Tick grid lines */}
            {Array.from({ length: ticks }, (_, ti) => (
              <line
                key={ti}
                x1={tickX(ti + 1)}
                y1={PADDING_TOP + i * LANE_H}
                x2={tickX(ti + 1)}
                y2={PADDING_TOP + i * LANE_H + LANE_H}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
            ))}
          </g>
        ))}

        {/* Current tick indicator */}
        <line
          x1={tickX(currentTick)}
          y1={PADDING_TOP}
          x2={tickX(currentTick)}
          y2={svgH - PADDING_TOP}
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.6}
        />

        {/* Events */}
        {events.map((evt) => {
          const laneIndex = LANE_DEFS.findIndex((l) => l.kind === evt.kind);
          if (laneIndex < 0) return null;
          const cx = tickX(evt.tick);
          const cy = laneY(laneIndex);
          const isHovered = tooltip?.event.id === evt.id;
          return (
            <EventMarker
              key={evt.id}
              event={evt}
              cx={cx}
              cy={cy}
              isHovered={isHovered}
              onClick={() => {
                setTooltip(null);
                onEventClick(evt);
              }}
              onMouseEnter={() => handleMouseEnter(evt, cx, cy)}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border bg-popover shadow-lg p-2 text-xs max-w-48"
          style={{
            // Convert SVG coords to rough % position
            left: `${((tooltip.x / 900) * 100).toFixed(1)}%`,
            top: `${tooltip.y + 16}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-semibold">{tooltip.event.label}</p>
          <p className="text-muted-foreground mt-0.5">{tooltip.event.detail}</p>
          <p className="text-muted-foreground mt-0.5">Tick {tooltip.event.tick}</p>
        </div>
      )}
    </div>
  );
}
