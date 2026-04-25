'use client';

import * as React from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Job types hardcoded per the plan's instruction
export const ROUTING_JOB_TYPES = [
  'initialize_big_bang',
  'simulate_universe_tick',
  'agent_deliberation_batch',
  'execute_due_events',
  'social_propagation',
  'sociology_update',
  'god_agent_review',
  'branch_universe',
  'force_deviation',
  'aggregate_run_results',
  'sync_zep_memory',
  'build_review_index',
  'export_run',
  'apply_tick_results',
] as const;

type JobType = typeof ROUTING_JOB_TYPES[number];

const PROVIDERS = ['openrouter'];
const MODELS = [
  'google/gemini-3.1-flash-lite-preview',
  'deepseek/deepseek-v3.2',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-flash',
  'openai/gpt-5.5',
  'openai/gpt-5.4',
  'openai/gpt-4o-mini',
];

export const GOD_TIER_JOB_TYPES = [
  'god_agent_review',
  'force_deviation',
  'aggregate_run_results',
] as const;

export function isGodTierJobType(jobType: string) {
  return (GOD_TIER_JOB_TYPES as readonly string[]).includes(jobType);
}

export interface RoutingPolicyRow {
  jobType: JobType;
  provider: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  concurrency: number;
  rpm: number;
  tpm: number;
  dailyCap: number;
}

export const DEFAULT_ROUTING_ROWS: RoutingPolicyRow[] = ROUTING_JOB_TYPES.map((jt) => ({
  jobType: jt,
  provider: 'openrouter',
  model: isGodTierJobType(jt) ? 'openai/gpt-5.5' : 'deepseek/deepseek-v3.2',
  temperature: jt === 'initialize_big_bang' ? 0.8 : 0.7,
  topP: 0.95,
  maxTokens: isGodTierJobType(jt) ? 8192 : 4096,
  concurrency: jt === 'agent_deliberation_batch' ? 20 : 4,
  rpm: 500,
  tpm: 200000,
  dailyCap: 5000000,
}));

function EditableNumberCell({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Input
      type="number"
      value={value}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-7 w-20 text-xs font-mono"
    />
  );
}

const col = createColumnHelper<RoutingPolicyRow>();

export function RoutingPoliciesTable({
  rows,
  onRowsChange,
}: {
  rows?: RoutingPolicyRow[];
  onRowsChange?: (rows: RoutingPolicyRow[]) => void;
}) {
  const [internalRows, setInternalRows] = React.useState<RoutingPolicyRow[]>(DEFAULT_ROUTING_ROWS);
  const data = rows ?? internalRows;

  const setRows = (updater: (rows: RoutingPolicyRow[]) => RoutingPolicyRow[]) => {
    const next = updater(data);
    if (rows) {
      onRowsChange?.(next);
    } else {
      setInternalRows(next);
    }
  };

  const updateRow = (jobType: JobType, field: keyof RoutingPolicyRow, value: string | number) => {
    setRows((prev) =>
      prev.map((r) => (r.jobType === jobType ? { ...r, [field]: value } : r))
    );
  };

  const columns = [
    col.accessor('jobType', {
      header: 'Job Type',
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('provider', {
      header: 'Provider',
      cell: (info) => (
        <Select
          value={info.getValue()}
          onValueChange={(v) => updateRow(info.row.original.jobType, 'provider', v)}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    }),
    col.accessor('model', {
      header: 'Model',
      cell: (info) => (
        <Select
          value={info.getValue()}
          onValueChange={(v) => updateRow(info.row.original.jobType, 'model', v)}
        >
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    }),
    col.accessor('temperature', {
      header: 'Temp',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          step={0.1}
          onChange={(v) => updateRow(info.row.original.jobType, 'temperature', v)}
        />
      ),
    }),
    col.accessor('topP', {
      header: 'Top-P',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          step={0.1}
          onChange={(v) => updateRow(info.row.original.jobType, 'topP', v)}
        />
      ),
    }),
    col.accessor('maxTokens', {
      header: 'Max Tokens',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          onChange={(v) => updateRow(info.row.original.jobType, 'maxTokens', v)}
        />
      ),
    }),
    col.accessor('concurrency', {
      header: 'Concurrency',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          onChange={(v) => updateRow(info.row.original.jobType, 'concurrency', v)}
        />
      ),
    }),
    col.accessor('rpm', {
      header: 'RPM',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          onChange={(v) => updateRow(info.row.original.jobType, 'rpm', v)}
        />
      ),
    }),
    col.accessor('tpm', {
      header: 'TPM',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          onChange={(v) => updateRow(info.row.original.jobType, 'tpm', v)}
        />
      ),
    }),
    col.accessor('dailyCap', {
      header: 'Daily Cap',
      cell: (info) => (
        <EditableNumberCell
          value={info.getValue()}
          onChange={(v) => updateRow(info.row.original.jobType, 'dailyCap', v)}
        />
      ),
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="text-xs h-8 whitespace-nowrap">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="text-xs py-1.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
