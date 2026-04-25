import * as React from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusPill } from '@/components/chrome/StatusPill';
import type { Run } from '@/lib/types/run';

interface SessionMetadataSidebarProps {
  run: Run;
}

function truncate(str: string, max = 16) {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface MetaRowProps {
  label: string;
  value: React.ReactNode;
}

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground break-all">{value}</div>
    </div>
  );
}

export function SessionMetadataSidebar({ run }: SessionMetadataSidebarProps) {
  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Session metadata</CardTitle>
      </CardHeader>
      <CardContent className="text-sm divide-y divide-border/60 px-4 pb-4">
        <MetaRow label="Run ID" value={<span className="font-mono text-xs">{truncate(run.id, 20)}</span>} />
        <MetaRow label="Big Bang ID" value={<span className="font-mono text-xs">{truncate(run.big_bang_id, 20)}</span>} />
        <MetaRow label="Scenario type" value={run.scenario_type} />
        <MetaRow label="Created at" value={formatDate(run.created_at)} />
        <MetaRow label="Time horizon" value={run.time_horizon} />
        <MetaRow label="Max ticks" value={String(run.max_ticks)} />
        <MetaRow label="Provider" value={run.provider} />
        <MetaRow label="Model" value={<span className="font-mono text-xs">{run.model}</span>} />
        <MetaRow
          label="Snapshot SHA"
          value={
            <span className="font-mono text-xs" title={run.snapshot_sha}>
              {truncate(run.snapshot_sha, 14)}
            </span>
          }
        />
        <MetaRow
          label="Zep status"
          value={
            <StatusPill
              status={
                run.zep_status === 'healthy'
                  ? 'active'
                  : run.zep_status === 'degraded'
                  ? 'degraded'
                  : 'paused'
              }
              showDot={false}
            />
          }
        />

        <Separator className="my-3" />

        <div className="space-y-2 pt-2">
          <Button variant="outline" size="sm" className="w-full gap-1.5 justify-start">
            <FolderOpen className="h-3.5 w-3.5" />
            Open exports
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-1.5 justify-start">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
