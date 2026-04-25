'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, RefreshCw } from 'lucide-react';

import { JobsKpiStrip } from '@/components/jobs/JobsKpiStrip';
import { JobsHeatmap } from '@/components/jobs/JobsHeatmap';
import { JobsFilters, type JobFilters } from '@/components/jobs/JobsFilters';
import { JobsTable, type JobRow } from '@/components/jobs/JobsTable';
import { QueuesPanel } from '@/components/jobs/QueuesPanel';
import type { JobStatus } from '@/components/jobs/StatusBadge';

/* ─── Mock data ───────────────────────────────────────────────────── */

const TYPES = [
  'simulate_universe_tick',
  'agent_deliberation_batch',
  'branch_universe',
  'sync_zep_memory',
  'export_run',
  'social_propagation',
];
const QUEUES = ['p0', 'p1', 'p2', 'p3', 'dead'];
const STATUSES: JobStatus[] = ['pending', 'running', 'success', 'failed', 'retrying', 'cancelled'];
const WORKERS = ['p0@worker-1', 'p1@worker-2', 'p1@worker-3', 'p2@worker-4'];

function makeMockJobs(n = 40): JobRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `job_${Math.random().toString(36).slice(2, 10)}_${i}`,
    type: TYPES[i % TYPES.length],
    queue: QUEUES[i % QUEUES.length],
    status: STATUSES[i % STATUSES.length],
    worker: WORKERS[i % WORKERS.length],
    progress: Math.round(Math.random() * 100),
    started: `${Math.round(Math.random() * 60)}m ago`,
    latency: `${(Math.random() * 4 + 0.2).toFixed(2)}s`,
    retries: Math.round(Math.random() * 3),
  }));
}

const INITIAL_JOBS = makeMockJobs(40);

const DEFAULT_FILTERS: JobFilters = {
  queue: 'all',
  status: 'all',
  jobType: 'all',
  timeRange: '1h',
  search: '',
};

/* ─── Page ────────────────────────────────────────────────────────── */

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>(INITIAL_JOBS);

  const refresh = useCallback(() => {
    setJobs(makeMockJobs(40));
  }, []);

  // Filter jobs locally from mock data
  const visible = jobs.filter((j) => {
    if (filters.queue !== 'all' && j.queue !== filters.queue) return false;
    if (filters.status !== 'all' && j.status !== filters.status) return false;
    if (filters.jobType !== 'all' && j.type !== filters.jobType) return false;
    if (
      filters.search &&
      !j.id.includes(filters.search) &&
      !j.type.includes(filters.search) &&
      !j.worker.includes(filters.search)
    )
      return false;
    return true;
  });

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
      <JobsKpiStrip />

      {/* Heatmap */}
      <JobsHeatmap />

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
              onRetry={(id) => console.log('retry', id)}
              onCancel={(id) => console.log('cancel', id)}
              onViewArtifact={(id) => console.log('artifact', id)}
              onViewPrompt={(id) => console.log('prompt', id)}
              onDelete={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
            />
          </div>
        </div>

        {/* Right rail — Queues */}
        <div className="w-72 flex-shrink-0">
          <QueuesPanel />
        </div>
      </div>
    </div>
  );
}
