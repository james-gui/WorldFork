'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Download, GitBranch, Network, Play, ScrollText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TimelineTabs } from '@/components/timeline/TimelineTabs';
import type { TimelineEvent } from '@/components/timeline/EventMarker';
import { TracePanel } from '@/components/trace/TracePanel';
import { useExportRun, useRun } from '@/lib/api/runs';
import { useLogs } from '@/lib/api/logs';
import { useJobs } from '@/lib/api/jobs';
import { useStepUniverse, useTickArtifact, useUniverse } from '@/lib/api/universes';

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'None';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function metricEntries(metrics?: Record<string, unknown>) {
  return Object.entries(metrics ?? {})
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
    .slice(0, 8);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function recordString(record: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return fallback;
}

function recordNumber(record: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([id, nested]) => ({ id, ...(asRecord(nested) ?? { value: nested }) }));
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'failed' || status === 'killed') return 'destructive';
  if (status === 'paused' || status === 'frozen') return 'outline';
  if (status === 'active' || status === 'running' || status === 'completed' || status === 'delivered') return 'default';
  return 'secondary';
}

export default function UniversePage({
  params,
}: {
  params: { runId: string; universeId: string };
}) {
  const { runId, universeId } = params;
  const { data: run } = useRun(runId);
  const { data: universe } = useUniverse(universeId);
  const currentTick = universe?.current_tick ?? 0;
  const { data: artifact } = useTickArtifact(universeId, currentTick);
  const { data: logs = [] } = useLogs({ runId, universeId, limit: 8 });
  const { data: jobs } = useJobs({ run_id: runId, limit: 8 });
  const stepUniverse = useStepUniverse();
  const exportRun = useExportRun();

  const posts = React.useMemo(() => artifact?.social_posts ?? [], [artifact?.social_posts]);
  const decisions = React.useMemo(() => artifact?.parsed_decisions ?? [], [artifact?.parsed_decisions]);
  const metrics = metricEntries(universe?.latest_metrics ?? artifact?.metrics);
  const stateAfter = asRecord(artifact?.state_after);
  const universeJobs = React.useMemo(
    () => (jobs?.jobs ?? []).filter((job) => !job.universe_id || job.universe_id === universeId).slice(0, 6),
    [jobs, universeId],
  );
  const timelinePosts = React.useMemo(
    () => posts.map((post, index) => {
      const record = asRecord(post) ?? {};
      return {
        id: recordString(record, ['id', 'post_id', 'message_id'], `post-${currentTick}-${index}`),
        author: recordString(record, ['author', 'actor', 'cohort', 'source', 'speaker'], 'Unknown actor'),
        content: recordString(record, ['content', 'text', 'message', 'body'], formatValue(post)),
        tick: recordNumber(record, ['tick'], currentTick),
        amplification: recordNumber(record, ['amplification', 'reach', 'engagement', 'likes'], 1),
      };
    }),
    [currentTick, posts],
  );
  const timelineCohorts = React.useMemo(
    () => recordArray(stateAfter?.cohorts).map((cohort, index) => ({
      id: recordString(cohort, ['id', 'cohort_id', 'name'], `cohort-${index}`),
      name: recordString(cohort, ['name', 'label', 'cohort_id', 'id'], `Cohort ${index + 1}`),
      population: recordNumber(cohort, ['population', 'size', 'members'], 0),
      dominantEmotion: recordString(cohort, ['dominant_emotion', 'dominantEmotion', 'emotion', 'mood'], 'unknown'),
      stance: recordString(cohort, ['stance', 'issue_stance', 'position', 'belief'], 'unspecified'),
    })),
    [stateAfter],
  );
  const timelineEvents = React.useMemo<TimelineEvent[]>(() => {
    const stateEvents = recordArray(asRecord(artifact)?.events ?? stateAfter?.events);
    const godDecision = asRecord(artifact?.god_decision);
    const events: TimelineEvent[] = [
      ...posts.slice(0, 8).map((post, index) => {
        const record = asRecord(post) ?? {};
        return {
          id: `timeline-post-${recordString(record, ['id', 'post_id'], String(index))}`,
          tick: recordNumber(record, ['tick'], currentTick),
          kind: 'posts' as const,
          label: recordString(record, ['author', 'actor', 'cohort', 'source'], `Post ${index + 1}`),
          detail: recordString(record, ['content', 'text', 'message', 'body'], formatValue(post)),
        };
      }),
      ...decisions.slice(0, 8).map((decision, index) => {
        const record = asRecord(decision) ?? {};
        return {
          id: `timeline-decision-${recordString(record, ['id', 'decision_id'], String(index))}`,
          tick: recordNumber(record, ['tick'], currentTick),
          kind: 'events' as const,
          label: recordString(record, ['type', 'event_type', 'decision', 'action', 'name'], `Decision ${index + 1}`),
          detail: recordString(record, ['description', 'detail', 'reason', 'summary'], formatValue(decision)),
        };
      }),
      ...(artifact?.tool_calls ?? []).slice(0, 8).map((call, index) => ({
        id: `timeline-tool-${call.id || index}`,
        tick: currentTick,
        kind: 'events' as const,
        label: call.name,
        detail: `${call.status}: ${formatValue(call.args)}`,
      })),
      ...stateEvents.slice(0, 8).map((event, index) => ({
        id: `timeline-event-${recordString(event, ['id', 'event_id'], String(index))}`,
        tick: recordNumber(event, ['tick'], currentTick),
        kind: 'events' as const,
        label: recordString(event, ['type', 'event_type', 'name', 'label'], `Event ${index + 1}`),
        detail: recordString(event, ['description', 'detail', 'summary'], formatValue(event)),
      })),
      ...timelineCohorts.slice(0, 4).map((cohort) => ({
        id: `timeline-cohort-${cohort.id}`,
        tick: currentTick,
        kind: 'cohorts' as const,
        label: cohort.name,
        detail: `${cohort.population.toLocaleString()} people / ${cohort.dominantEmotion} / ${cohort.stance}`,
      })),
    ];
    if (godDecision) {
      events.unshift({
        id: `timeline-god-${currentTick}`,
        tick: currentTick,
        kind: 'god',
        label: recordString(godDecision, ['action', 'decision', 'title', 'name'], 'God agent decision'),
        detail: recordString(godDecision, ['reason', 'rationale', 'summary', 'description'], formatValue(godDecision)),
      });
    }
    return events;
  }, [artifact, currentTick, decisions, posts, stateAfter, timelineCohorts]);
  const timelineLogs = React.useMemo(
    () => [
      ...logs.map((log) => ({
        id: `call-${log.call_id}`,
        tick: log.tick ?? currentTick,
        level: (log.status === 'failed' || log.error ? 'error' : 'info') as 'info' | 'warn' | 'error',
        message: `${log.job_type}: ${log.provider}/${log.model_used} ${log.status}`,
      })),
      ...universeJobs.map((job) => ({
        id: `job-${job.job_id}`,
        tick: job.tick ?? currentTick,
        level: (job.status === 'failed' || job.error ? 'error' : job.status === 'queued' ? 'warn' : 'info') as 'info' | 'warn' | 'error',
        message: `${job.job_type}: ${job.status}`,
      })),
    ].slice(0, 16),
    [currentTick, logs, universeJobs],
  );

  const handleStep = async () => {
    try {
      const result = await stepUniverse.mutateAsync({ uid: universeId });
      toast.success(`Queued tick ${result.tick}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue tick.');
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportRun.mutateAsync(runId);
      toast.success(`Export job ${result.job_id} queued.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue export.');
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5">
            <Link href={`/runs/${runId}/dashboard`}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {run?.display_name ?? 'Run'} / {universeId}
            </h1>
            <Badge variant={statusVariant(universe?.status)}>{universe?.status ?? 'loading'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {run?.scenario_text || 'Universe details will populate after the Big Bang initializer completes.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={handleStep} disabled={stepUniverse.isPending}>
            <Play className="h-3.5 w-3.5" />
            Step Tick
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={exportRun.isPending}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/runs/${runId}/network`}>
              <Network className="h-3.5 w-3.5" />
              Network
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/runs/${runId}/multiverse`}>
              <GitBranch className="h-3.5 w-3.5" />
              Multiverse
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/runs/${runId}/universes/${universeId}/review`}>
              <ScrollText className="h-3.5 w-3.5" />
              Review
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Current Tick', currentTick],
          ['Depth', universe?.branch_depth ?? 0],
          ['Active Cohorts', universe?.active_cohort_count ?? 0],
          ['Children', universe?.child_universe_ids?.length ?? 0],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{formatValue(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Simulation Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineTabs
                events={timelineEvents}
                cohorts={timelineCohorts}
                posts={timelinePosts}
                logs={timelineLogs}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Latest Tick Artifact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {metrics.length > 0 ? metrics.map(([key, value]) => (
                  <div key={key} className="rounded-md border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{key}</p>
                    <p className="text-sm font-medium mt-1 truncate">{formatValue(value)}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No metrics have been written for this universe yet.</p>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h2 className="text-sm font-semibold mb-2">Posts</h2>
                  <div className="space-y-2">
                    {posts.slice(0, 5).map((post, index) => (
                      <pre key={index} className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap overflow-hidden">
                        {formatValue(post)}
                      </pre>
                    ))}
                    {posts.length === 0 && (
                      <p className="text-sm text-muted-foreground">No posts recorded for tick {currentTick}.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold mb-2">Decisions And Events</h2>
                  <div className="space-y-2">
                    {decisions.slice(0, 5).map((decision, index) => (
                      <pre key={index} className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap overflow-hidden">
                        {formatValue(decision)}
                      </pre>
                    ))}
                    {decisions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No parsed decisions recorded for tick {currentTick}.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ledger And Branch State</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Run folder:</span> {run?.run_folder_path ?? 'Not assigned'}</p>
                <p><span className="text-muted-foreground">Source of truth:</span> {run?.source_of_truth_version ?? 'Unknown'}</p>
                <p><span className="text-muted-foreground">Parent:</span> {universe?.parent_universe_id ?? 'Root universe'}</p>
                <p><span className="text-muted-foreground">Branched from tick:</span> {universe?.branch_from_tick ?? 0}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Branch reason</p>
                <pre className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap overflow-hidden">
                  {universe?.branch_reason || 'Root initialization'}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent LLM Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map((log) => (
                <div key={log.call_id} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{log.job_type}</p>
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {log.provider} / {log.model_used} / {log.total_tokens.toLocaleString()} tokens
                  </p>
                  {log.error && <p className="text-[11px] text-destructive mt-1">{log.error}</p>}
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground">No LLM calls logged for this universe.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {universeJobs.map((job) => (
                <div key={job.job_id} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{job.job_type}</p>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    tick {job.tick ?? 'n/a'} / attempt {job.attempt_number}
                  </p>
                  {job.error && <p className="text-[11px] text-destructive mt-1">{job.error}</p>}
                </div>
              ))}
              {universeJobs.length === 0 && (
                <p className="text-sm text-muted-foreground">No jobs returned for this universe yet.</p>
              )}
            </CardContent>
          </Card>

          <TracePanel universeId={universeId} tick={currentTick} compact />
        </aside>
      </div>
    </div>
  );
}
