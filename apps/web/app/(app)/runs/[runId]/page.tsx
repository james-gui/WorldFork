'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Archive, BarChart3, Copy, Download, ExternalLink, GitBranch, Network, ScrollText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useArchiveRun, useDuplicateRun, useExportRun, useRun, useRunSourceOfTruth } from '@/lib/api/runs';
import { useJobs } from '@/lib/api/jobs';
import { useLogs } from '@/lib/api/logs';

function formatDate(value?: string | null) {
  if (!value) return 'None';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'paused' || status === 'archived') return 'outline';
  if (status === 'active' || status === 'running' || status === 'completed') return 'default';
  return 'secondary';
}

function jsonPreview(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

export default function RunSessionPage({
  params,
}: {
  params: { runId: string };
}) {
  const { runId } = params;
  const { data: run, error, isLoading } = useRun(runId);
  const { data: sot } = useRunSourceOfTruth(runId);
  const { data: logs = [] } = useLogs({ runId, limit: 12 });
  const { data: jobs } = useJobs({ run_id: runId, limit: 12, refetchInterval: false });
  const exportRun = useExportRun();
  const archiveRun = useArchiveRun();
  const duplicateRun = useDuplicateRun();

  const totals = React.useMemo(() => {
    const tokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const cost = logs.reduce((sum, log) => sum + (log.cost_usd ?? 0), 0);
    const failures = logs.filter((log) => log.status !== 'success' || log.error).length;
    return { tokens, cost, failures };
  }, [logs]);

  const handleExport = async () => {
    try {
      const result = await exportRun.mutateAsync(runId);
      toast.success(`Export job ${result.job_id} queued.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue export.');
    }
  };

  const handleDuplicate = async () => {
    try {
      const result = await duplicateRun.mutateAsync(runId);
      toast.success(`Duplicated as ${result.run_id}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate run.');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveRun.mutateAsync(runId);
      toast.success('Run archived.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive run.');
    }
  };

  if (isLoading && !run) {
    return <div className="p-6 text-sm text-muted-foreground">Loading run session...</div>;
  }

  if (error || !run) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Run session detail is unavailable.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{run.display_name}</h1>
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{run.run_id}</p>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{run.scenario_text}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/runs/${runId}/dashboard`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/runs/${runId}/multiverse`}>
              <GitBranch className="h-3.5 w-3.5" />
              Multiverse
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/runs/${runId}/results`}>
              <BarChart3 className="h-3.5 w-3.5" />
              Results
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleDuplicate} disabled={duplicateRun.isPending}>
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exportRun.isPending}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleArchive} disabled={archiveRun.isPending}>
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Universes', run.total_universe_count],
          ['Active Universes', run.active_universe_count],
          ['Max Ticks', run.max_ticks],
          ['LLM Tokens', totals.tokens],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{Number(value).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="metadata" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Run Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Root universe:</span> {run.root_universe_id}</p>
                <p><span className="text-muted-foreground">Time horizon:</span> {run.time_horizon_label}</p>
                <p><span className="text-muted-foreground">Tick duration:</span> {run.tick_duration_minutes} minutes</p>
                <p><span className="text-muted-foreground">Created:</span> {formatDate(run.created_at)}</p>
                <p><span className="text-muted-foreground">Updated:</span> {formatDate(run.updated_at)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Run folder:</span> {run.run_folder_path ?? 'Not assigned'}</p>
                <p><span className="text-muted-foreground">SoT version:</span> {run.source_of_truth_version ?? sot?.version ?? 'Unknown'}</p>
                <p><span className="text-muted-foreground">Provider snapshot:</span> {run.provider_snapshot_id ?? 'Current settings'}</p>
                <p><span className="text-muted-foreground">Cost logged:</span> ${totals.cost.toFixed(4)}</p>
                <p><span className="text-muted-foreground">LLM failures:</span> {totals.failures}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inputs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Scenario And Source Of Truth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">{run.scenario_text}</pre>
              <Separator />
              <pre className="max-h-[420px] overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                {jsonPreview(sot ?? { version: run.source_of_truth_version })}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Recent Provider Calls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map((log) => (
                <div key={log.call_id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{log.job_type}</span>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {log.provider} / {log.model_used} / {log.total_tokens.toLocaleString()} tokens
                  </p>
                  {log.error && <p className="mt-1 text-destructive">{log.error}</p>}
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-muted-foreground">No provider calls recorded.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(jobs?.jobs ?? []).map((job) => (
                <div key={job.job_id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{job.job_type}</span>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {job.priority} / tick {job.tick ?? 'n/a'} / attempt {job.attempt_number}
                  </p>
                  {job.error && <p className="mt-1 text-destructive">{job.error}</p>}
                </div>
              ))}
              {!(jobs?.jobs ?? []).length && <p className="text-sm text-muted-foreground">No jobs recorded.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reproducibility And Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Historical artifacts are exported from the immutable run ledger. Parent run
                folders are not modified during export.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href={`/runs/${runId}/network`}>
                    <Network className="h-3.5 w-3.5" />
                    Network
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href={`/runs/${runId}/results`}>
                    <BarChart3 className="h-3.5 w-3.5" />
                    Results
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-1.5">
                  <Link href={`/runs/${runId}/universes/${run.root_universe_id}`}>
                    <GitBranch className="h-3.5 w-3.5" />
                    Root Universe
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exportRun.isPending}>
                  <Download className="h-3.5 w-3.5" />
                  Queue Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
