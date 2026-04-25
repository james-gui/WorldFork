'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw } from 'lucide-react';

export interface JobFilters {
  queue: string;
  status: string;
  jobType: string;
  timeRange: string;
  search: string;
}

interface JobsFiltersProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  onRefresh?: () => void;
}

export function JobsFilters({ filters, onChange, onRefresh }: JobsFiltersProps) {
  const set = (key: keyof JobFilters) => (val: string) =>
    onChange({ ...filters, [key]: val });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search job ID, type, worker…"
          value={filters.search}
          onChange={(e) => set('search')(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Select value={filters.queue} onValueChange={set('queue')}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue placeholder="Queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All queues</SelectItem>
          <SelectItem value="p0">P0</SelectItem>
          <SelectItem value="p1">P1</SelectItem>
          <SelectItem value="p2">P2</SelectItem>
          <SelectItem value="p3">P3</SelectItem>
          <SelectItem value="dead_letter">Dead</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={set('status')}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="retrying">Retrying</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="dead">Dead</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.jobType} onValueChange={set('jobType')}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder="Job type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="initialize_big_bang">Initialize</SelectItem>
          <SelectItem value="simulate_universe_tick">Sim tick</SelectItem>
          <SelectItem value="agent_deliberation_batch">Agent batch</SelectItem>
          <SelectItem value="god_agent_review">God review</SelectItem>
          <SelectItem value="branch_universe">Branch</SelectItem>
          <SelectItem value="force_deviation">Force deviation</SelectItem>
          <SelectItem value="aggregate_run_results">Results</SelectItem>
          <SelectItem value="apply_tick_results">Apply tick</SelectItem>
          <SelectItem value="sync_zep_memory">Zep sync</SelectItem>
          <SelectItem value="export_run">Export</SelectItem>
          <SelectItem value="social_propagation">Social prop</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.timeRange} onValueChange={set('timeRange')}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15m">Last 15 min</SelectItem>
          <SelectItem value="1h">Last 1 hour</SelectItem>
          <SelectItem value="6h">Last 6 hours</SelectItem>
          <SelectItem value="24h">Last 24 hours</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 px-2">
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
