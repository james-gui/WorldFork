'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNetworkUIStore } from '@/lib/state/networkUiStore';
import {
  type NetworkDataset,
  type NetworkNodeAttrs,
} from '@/lib/network/types';
import { IdeologyAxesRadial } from './IdeologyAxesRadial';
import { IssueStanceBars } from './IssueStanceBars';
import { Users, MousePointerClick } from 'lucide-react';

interface Props {
  data?: NetworkDataset;
}

export function CohortInspector({ data }: Props) {
  const selectedNodeId = useNetworkUIStore((s) => s.selectedNodeId);
  const activeLayer = useNetworkUIStore((s) => s.activeLayer);

  const node = React.useMemo(() => {
    if (!data || !selectedNodeId) return undefined;
    return data.nodes.find((n) => n.id === selectedNodeId);
  }, [data, selectedNodeId]);

  // Connections under the active layer (computed unconditionally so hook
  // order remains stable across renders).
  const connections = React.useMemo(() => {
    if (!data || !node) return [] as { id: string; otherId: string; weight: number }[];
    const out: { id: string; otherId: string; weight: number }[] = [];
    for (const e of data.edges) {
      if (e.attrs.layer !== activeLayer) continue;
      if (e.source === node.id) {
        out.push({ id: e.id, otherId: e.target, weight: e.attrs.weight });
      } else if (e.target === node.id) {
        out.push({ id: e.id, otherId: e.source, weight: e.attrs.weight });
      }
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 12);
  }, [data, node, activeLayer]);

  if (!data || !node) {
    return (
      <Card className="w-[380px] shrink-0 p-6 grid place-items-center text-center min-h-[300px]">
        <div className="space-y-2 text-muted-foreground">
          <MousePointerClick className="size-8 mx-auto opacity-60" />
          <p className="text-sm font-medium text-foreground">
            Cohort inspector
          </p>
          <p className="text-xs">Click a node in the graph to inspect.</p>
        </div>
      </Card>
    );
  }

  const attrs = node.attrs;
  const archetype = data.archetypes.find((a) => a.key === attrs.archetype);

  return (
    <Card className="w-[380px] shrink-0 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: archetype?.color ?? attrs.color }}
            />
            <h3 className="font-semibold truncate">{archetype?.label ?? attrs.archetype}</h3>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {attrs.label}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] uppercase">
          Cohort
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-8">
          <TabsTrigger value="overview" className="text-[11px]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="stance" className="text-[11px]">
            Stance
          </TabsTrigger>
          <TabsTrigger value="posts" className="text-[11px]">
            Posts
          </TabsTrigger>
          <TabsTrigger value="conn" className="text-[11px]">
            Conn.
          </TabsTrigger>
        </TabsList>

        {/* Overview ------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4 pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat
              label="Population"
              value={attrs.representedPopulation.toLocaleString()}
              icon={<Users className="size-3" />}
            />
            <Stat label="Stance" value={attrs.cohortStance.toFixed(2)} />
          </div>

          <Bar label="Trust" v={attrs.trust} />
          <Bar label="Analytical depth" v={attrs.analyticalDepth} />
          <Bar label="Expression" v={attrs.expressionLevel} />
          <Bar label="Mobilization" v={attrs.mobilizationCapacity} />

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Ideology axes
            </p>
            <IdeologyAxesRadial values={attrs.ideology} size={200} />
          </div>
        </TabsContent>

        {/* Stance --------------------------------------------------- */}
        <TabsContent value="stance" className="space-y-3 pt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Issue stance (-1 oppose · +1 support)
          </p>
          <IssueStanceBars stances={attrs.issueStances} />
        </TabsContent>

        {/* Recent posts --------------------------------------------- */}
        <TabsContent value="posts" className="pt-3">
          <ScrollArea className="h-[280px] pr-2">
            <ul className="space-y-2">
              {attrs.recentPosts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border bg-muted/30 p-2 text-xs"
                >
                  <p className="leading-snug">{p.text}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {p.tickAgo} ticks ago
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </TabsContent>

        {/* Connections ---------------------------------------------- */}
        <TabsContent value="conn" className="pt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Top neighbors · {activeLayer}
          </p>
          <ScrollArea className="h-[280px] pr-2">
            {connections.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No connections in this layer.
              </p>
            ) : (
              <ul className="space-y-1">
                {connections.map((c) => {
                  const other = data?.nodes.find((n) => n.id === c.otherId);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-xs gap-2 rounded px-2 py-1 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: other?.attrs.color }}
                        />
                        <span className="truncate">
                          {other?.attrs.label ?? c.otherId}
                        </span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {c.weight.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{v.toFixed(2)}</span>
      </div>
      <Progress value={v * 100} className="h-1.5" />
    </div>
  );
}
