'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EventDetail } from './EventDetail';
import { BarChart2, GitBranch, Pause } from 'lucide-react';

interface BranchSummaryPanelProps {
  status: 'Active' | 'Candidate' | 'Frozen' | 'Killed';
  tickRange: [number, number];
  keyDivergence: string;
  onCompare?: () => void;
  onBranch?: () => void;
  onPause?: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  Active: 'bg-emerald-500 text-white',
  Candidate: 'bg-yellow-400 text-black',
  Frozen: 'bg-blue-400 text-white',
  Killed: 'bg-rose-500 text-white',
};

export function BranchSummaryPanel({
  status,
  tickRange,
  keyDivergence,
  onCompare,
  onBranch,
  onPause,
}: BranchSummaryPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Branch Summary</CardTitle>
            <Badge className={`text-xs border-0 ${STATUS_CLASS[status]}`}>{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20 shrink-0">Tick Range</span>
            <span className="text-xs font-medium">
              T-{tickRange[0]} → T-{tickRange[1]}
            </span>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
              Key Divergence
            </p>
            <p className="text-xs text-muted-foreground">{keyDivergence}</p>
          </div>

          <Separator />

          {/* God Agent Intervention detail */}
          <EventDetail
            title="Policy Enforcement Wave"
            tick={4}
            type="God-Agent"
            description="God agent spawned this branch after detecting high mobilization risk in parent universe."
            subAgentRationale={{
              influence: 'High (0.84)',
              anchorSetup: 'Narrative anchor: economic stability framing',
              effects: [
                'Cohort A anger reduced by 1.2',
                'Distrust increased for Cohort B',
                'Hero H2 activated counter-narrative',
              ],
              rationale:
                'Branching chosen to explore counterfactual where policy intervention occurs 2 ticks earlier, reducing escalation probability.',
            }}
          />

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={onCompare}>
              <BarChart2 className="w-3.5 h-3.5 mr-2" />
              Compare
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={onBranch}>
              <GitBranch className="w-3.5 h-3.5 mr-2" />
              Branch
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={onPause}>
              <Pause className="w-3.5 h-3.5 mr-2" />
              Pause
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
