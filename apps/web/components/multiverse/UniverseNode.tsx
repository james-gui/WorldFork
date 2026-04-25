'use client';

import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STATUS_BADGE_CLS,
  STATUS_COLORS,
  triggerLabel,
  type MultiverseNodeData,
} from '@/lib/multiverse/types';

export interface UniverseNodePayload {
  universe: MultiverseNodeData;
  highlighted?: boolean;
  selected?: boolean;
  inCompare?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: (id: string) => void;
}

function UniverseNodeImpl(props: NodeProps) {
  const data = props.data as unknown as UniverseNodePayload;
  const u = data.universe;
  const sparkColor = STATUS_COLORS[u.status];
  const highlighted = data.highlighted;
  const selected = data.selected;
  const inCompare = data.inCompare;
  const collapsed = data.isCollapsed;
  // collapsed_children_count > 0 (server pre-aggregates) OR currently user-collapsed.
  const collapsedCount =
    collapsed && u.descendant_count > 0
      ? u.descendant_count
      : u.collapsed_children_count;

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <div
          data-lod="full"
          className={cn(
            'relative rounded-md border bg-card text-card-foreground shadow-sm transition-all',
            'hover:shadow-md',
            'data-[lod=tiny]:!w-2 data-[lod=tiny]:!h-2 data-[lod=tiny]:!rounded-full data-[lod=tiny]:!border-0 data-[lod=tiny]:!p-0',
            highlighted && 'ring-2 ring-amber-400/70',
            selected && 'ring-2 ring-primary',
            inCompare && 'outline outline-2 outline-fuchsia-500/70',
          )}
          style={{
            width: 220,
            height: 80,
            borderColor: highlighted ? '#facc15' : undefined,
          }}
        >
          {/* Tiny dot for LOD swap (controlled by a CSS attribute the renderer flips). */}
          <span
            className="absolute inset-0 hidden rounded-full data-[lod=tiny]:block"
            style={{ background: sparkColor }}
          />
          {/* Card body */}
          <div className="flex flex-col gap-1 px-2 py-1.5 lod-full">
            <div className="flex items-center justify-between gap-1">
              <Badge
                variant="outline"
                className={cn(
                  'h-4 px-1.5 text-[9px] uppercase tracking-wide',
                  STATUS_BADGE_CLS[u.status],
                )}
              >
                {u.status}
              </Badge>
              <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                D{u.depth}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="font-mono text-xs font-semibold truncate">
                {u.label}
              </span>
              <span
                className="text-[10px] tabular-nums text-muted-foreground"
                title="Divergence score"
              >
                {u.divergence_score.toFixed(2)}
              </span>
            </div>
            <div className="h-5 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={u.divergence_series}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`uni-spark-${u.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    fill={`url(#uni-spark-${u.id})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* +N collapsed-children pill (top-right) */}
          {collapsedCount > 0 ? (
            <button
              type="button"
              className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center gap-0.5 rounded-full border bg-background px-1.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleCollapsed?.(u.id);
              }}
              title={
                collapsed ? 'Expand subtree' : `Collapse +${collapsedCount} child universes`
              }
            >
              {collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              +{collapsedCount}
            </button>
          ) : null}

          <Handle
            type="target"
            position={Position.Left}
            style={{ background: sparkColor, opacity: 0.7 }}
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ background: sparkColor, opacity: 0.7 }}
          />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-72">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold">{u.label}</span>
          <Badge
            variant="outline"
            className={cn('h-5 text-[10px]', STATUS_BADGE_CLS[u.status])}
          >
            {u.status}
          </Badge>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-muted-foreground">Divergence</dt>
          <dd className="text-right tabular-nums">
            {u.divergence_score.toFixed(2)}
          </dd>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd className="text-right tabular-nums">{u.confidence.toFixed(2)}</dd>
          <dt className="text-muted-foreground">Children</dt>
          <dd className="text-right tabular-nums">{u.child_count}</dd>
          <dt className="text-muted-foreground">Descendants</dt>
          <dd className="text-right tabular-nums">{u.descendant_count}</dd>
          <dt className="text-muted-foreground">Trigger</dt>
          <dd className="text-right">{triggerLabel(u.branch_trigger)}</dd>
          <dt className="text-muted-foreground">Branch tick</dt>
          <dd className="text-right tabular-nums">T{u.branch_tick}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-right tabular-nums">
            {new Date(u.created_at).toLocaleString()}
          </dd>
        </dl>
        {data.onToggleCollapsed && u.descendant_count > 0 ? (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleCollapsed?.(u.id);
              }}
            >
              {collapsed ? 'Expand subtree' : 'Collapse subtree'}
            </Button>
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}

export const UniverseNode = React.memo(UniverseNodeImpl);
