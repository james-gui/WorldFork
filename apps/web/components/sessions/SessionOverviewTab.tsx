import * as React from 'react';
import Link from 'next/link';
import { Eye, Users, GitBranch, Clock, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Run } from '@/lib/types/run';

interface SessionOverviewTabProps {
  run: Run;
}

function buildFileTreePreview(rootUniverseId: string, currentTick: number) {
  const tickFolder = currentTick > 0 ? `ticks/T${String(currentTick).padStart(3, '0')}/` : 'ticks/';
  return [
    { name: 'config/', type: 'dir' },
    { name: 'source_of_truth_snapshot/', type: 'dir' },
    { name: `universes/${rootUniverseId}/`, type: 'dir' },
    { name: `  ${tickFolder}`, type: 'dir' },
    { name: '  actors/', type: 'dir' },
    { name: 'manifest.json', type: 'file' },
  ];
}

export function SessionOverviewTab({ run }: SessionOverviewTabProps) {
  const rootUniverseId = run.root_universe_id ?? run.big_bang_id;
  const fileTreePreview = buildFileTreePreview(rootUniverseId, run.current_tick);
  const summaryMetrics = [
    { label: 'Universes', value: run.universe_count.toLocaleString(), icon: GitBranch, color: 'text-brand-600' },
    { label: 'Ticks completed', value: run.current_tick.toLocaleString(), icon: Clock, color: 'text-sky-600' },
    { label: 'Archetypes', value: run.initial_archetype_count.toLocaleString(), icon: Users, color: 'text-emerald-600' },
    { label: 'Max ticks', value: run.max_ticks.toLocaleString(), icon: Activity, color: 'text-amber-600' },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Session Overview card */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Session Overview</CardTitle>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/runs/${run.id}/universes/${rootUniverseId}/review`}>
                  <Eye className="h-3.5 w-3.5" />
                  Open Review Mode
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {run.goal && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Goal</p>
                <p className="text-sm text-foreground">{run.goal}</p>
              </div>
            )}
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Scenario</p>
              <p className="text-sm text-foreground">{run.scenario_text}</p>
            </div>
            {run.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {run.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            {run.summary && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">{run.summary}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryMetrics.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="text-center">
              <CardContent className="pt-4 pb-3">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right: Files panel */}
      <div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Files</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm font-mono">
              {fileTreePreview.map((item) => (
                <li
                  key={item.name}
                  className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 transition-colors ${
                    item.type === 'dir' ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-muted-foreground text-xs">{item.type === 'dir' ? '[d]' : '[f]'}</span>
                  <span className="text-xs">{item.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
