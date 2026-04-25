'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Settings, RefreshCw } from 'lucide-react';

import { JobsKpiStrip } from '@/components/jobs/JobsKpiStrip';
import { JobsHeatmap } from '@/components/jobs/JobsHeatmap';
import { JobsFilters, type JobFilters } from '@/components/jobs/JobsFilters';
import { JobsTable, type JobRow } from '@/components/jobs/JobsTable';
import { QueuesPanel } from '@/components/jobs/QueuesPanel';
import type { QueueInfo as QueueRow } from '@/components/jobs/QueueCard';
import type { JobStatus } from '@/components/jobs/StatusBadge';
import { useCancelJob, useJobs, usePauseQueue, useQueues, useResumeQueue, useRetryJob } from '@/lib/api/jobs';
import type { JobInfo, QueueInfo } from '@/lib/api/types';

const DEFAULT_FILTERS: JobFilters = {
  queue: 'all',
  status: 'all',
  jobType: 'all',
  timeRange: '1h',
  search: '',
};

function mapStatus(status: string): JobStatus {
  if (status === 'queued') return 'pending';
  if (status === 'succeeded') return 'success';
  if (status === 'dead_letter') return 'dead';
  if (status === 'retried') return 'retrying';
  if (status === 'pending' || status === 'running' || status === 'success' || status === 'failed' || status === 'retrying' || status === 'cancelled' || status === 'dead') {
    return status;
  }
  return 'pending';
}

function backendStatus(status: string): string | undefined {
  if (status === 'all') return undefined;
  if (status === 'pending') return 'queued';
  if (status === 'success') return 'succeeded';
  if (status === 'dead') return 'dead_letter';
  return status;
}

function formatRelative(value?: string | null): string {
  if (!value) return '-';
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return value;
  const delta = Math.max(0, Date.now() - at);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatLatency(job: JobInfo): string {
  if (!job.started_at || !job.finished_at) return '-';
  const started = new Date(job.started_at).getTime();
  const finished = new Date(job.finished_at).getTime();
  if (Number.isNaN(started) || Number.isNaN(finished) || finished < started) return '-';
  const seconds = (finished - started) / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
}

function progressFor(job: JobInfo): number {
  const status = mapStatus(job.status);
  if (status === 'success') return 100;
  if (status === 'failed' || status === 'cancelled' || status === 'dead') return 100;
  if (status === 'running') return 50;
  return 0;
}

function adaptJob(job: JobInfo): JobRow {
  return {
    id: job.job_id,
    type: job.job_type,
    queue: job.priority,
    status: mapStatus(job.status),
    worker: '-',
    progress: progressFor(job),
    started: formatRelative(job.started_at ?? job.enqueued_at ?? job.created_at),
    latency: formatLatency(job),
    retries: Math.max(0, job.attempt_number - 1),
    artifactPath: job.artifact_path,
    resultSummary: job.result_summary,
    payload: job.payload,
  };
}

function adaptQueue(queue: QueueInfo): QueueRow {
  const depth = queue.reserved_count + queue.scheduled_count;
  return {
    name: queue.name,
    priority: queue.name === 'dead_letter' ? 'Dead' : queue.name.toUpperCase(),
    depth,
    workers: queue.active_task_count,
    paused: queue.paused,
  };
}

function cutoffForRange(range: string): number {
  const now = Date.now();
  const durations: Record<string, number> = {
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '6h': 6 * 60 * 60_000,
    '24h': 24 * 60 * 60_000,
    '7d': 7 * 24 * 60 * 60_000,
  };
  return now - (durations[range] ?? durations['1h']);
}

function jobTimestamp(job: JobInfo): number {
  const value = job.created_at ?? job.enqueued_at ?? job.started_at ?? job.finished_at;
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detail, setDetail] = useState<{ jobId: string; mode: 'artifact' | 'payload' } | null>(null);
  const jobsQuery = useJobs({
    queue: filters.queue === 'all' ? undefined : filters.queue,
    status: backendStatus(filters.status),
    type: filters.jobType === 'all' ? undefined : filters.jobType,
    limit: 200,
    refetchInterval: autoRefresh ? 10_000 : false,
  });
  const queuesQuery = useQueues({ refetchInterval: autoRefresh ? 10_000 : false });
  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();
  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const refresh = useCallback(() => {
    void jobsQuery.refetch();
    void queuesQuery.refetch();
  }, [jobsQuery, queuesQuery]);

  const filteredJobInfos = useMemo(() => {
    const cutoff = cutoffForRange(filters.timeRange);
    return (jobsQuery.data?.jobs ?? []).filter((job) => jobTimestamp(job) >= cutoff);
  }, [filters.timeRange, jobsQuery.data?.jobs]);
  const jobs = useMemo(
    () => filteredJobInfos.map(adaptJob),
    [filteredJobInfos],
  );
  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.id, j.type, j.queue, j.worker].some((part) => part.toLowerCase().includes(q)),
    );
  }, [filters.search, jobs]);
  const queues = useMemo(
    () => (queuesQuery.data?.queues ?? []).map(adaptQueue),
    [queuesQuery.data],
  );
  const metrics = useMemo(() => ({
    inFlight: jobs.filter((job) => job.status === 'running').length,
    activeQueues: queues.filter((queue) => queue.depth > 0 || queue.workers > 0).length,
    queued: jobs.filter((job) => job.status === 'pending').length,
    failed: jobs.filter((job) => job.status === 'failed' || job.status === 'dead').length,
    retries: jobs.reduce((sum, job) => sum + job.retries, 0),
    total: jobsQuery.data?.total ?? jobs.length,
  }), [jobs, jobsQuery.data?.total, queues]);
  const selectedJob = useMemo(
    () => jobsQuery.data?.jobs.find((job) => job.job_id === detail?.jobId),
    [detail?.jobId, jobsQuery.data?.jobs],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Background Jobs &amp; Queue Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time view of Celery queues, workers, and job execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              className="scale-75"
            />
            <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">
              Auto-refresh
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <JobsKpiStrip loading={jobsQuery.isLoading} metrics={metrics} />

      {/* Heatmap */}
      <JobsHeatmap jobs={jobsQuery.data?.jobs ?? []} />

      {/* Main content — table + right rail */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <JobsFilters filters={filters} onChange={setFilters} onRefresh={refresh} />

          {/* Table */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Showing {visible.length} of {jobs.length} jobs
            </p>
            <JobsTable
              data={visible}
              globalFilter={filters.search}
              onRetry={(id) => retryJob.mutate({ jobId: id })}
              onCancel={(id) => cancelJob.mutate(id)}
              onViewArtifact={(id) => setDetail({ jobId: id, mode: 'artifact' })}
              onViewPrompt={(id) => setDetail({ jobId: id, mode: 'payload' })}
            />
          </div>
        </div>

        {/* Right rail — Queues */}
        <div className="w-72 flex-shrink-0">
          <QueuesPanel
            queues={queues}
            onTogglePause={(name, paused) => {
              if (paused) pauseQueue.mutate(name);
              else resumeQueue.mutate(name);
            }}
          />
        </div>
      </div>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Job Detail</SheetTitle>
            <SheetDescription className="font-mono">
              {detail?.jobId}
            </SheetDescription>
          </SheetHeader>
          {selectedJob ? (
            <div className="mt-5 space-y-4 text-sm">
              {detail?.mode === 'artifact' ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Artifact Path
                  </div>
                  <div className="mt-1 break-all font-mono text-xs">
                    {selectedJob.artifact_path || 'No artifact path was recorded for this job.'}
                  </div>
                </div>
              ) : null}
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {detail?.mode === 'payload' ? 'Payload' : 'Result Summary'}
                </div>
                <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded bg-background p-3 text-xs">
                  {JSON.stringify(
                    detail?.mode === 'payload'
                      ? selectedJob.payload
                      : selectedJob.result_summary ?? {},
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm text-muted-foreground">
              Job detail is unavailable.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
