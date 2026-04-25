'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { StatusBadge, type JobStatus } from './StatusBadge';
import { JobActionMenu } from './JobActionMenu';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface JobRow {
  id: string;
  type: string;
  queue: string;
  status: JobStatus;
  worker: string;
  progress: number;
  started: string;
  latency: string;
  retries: number;
}

interface JobsTableProps {
  data: JobRow[];
  globalFilter?: string;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onViewArtifact?: (id: string) => void;
  onViewPrompt?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const columns: ColumnDef<JobRow>[] = [
  {
    accessorKey: 'id',
    header: 'Job ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{String(getValue()).slice(0, 16)}…</span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => (
      <span className="text-xs font-medium">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'queue',
    header: 'Queue',
    cell: ({ getValue }) => (
      <span className="text-xs font-mono uppercase">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue() as JobStatus} />,
  },
  {
    accessorKey: 'worker',
    header: 'Worker',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground font-mono">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ getValue }) => {
      const v = Number(getValue());
      return (
        <div className="flex items-center gap-2 min-w-[80px]">
          <Progress value={v} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground w-7 text-right">{v}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'started',
    header: 'Started',
    cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{String(getValue())}</span>,
  },
  {
    accessorKey: 'latency',
    header: 'Latency',
    cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span>,
  },
  {
    accessorKey: 'retries',
    header: 'Retries',
    cell: ({ getValue }) => {
      const v = Number(getValue());
      return (
        <span className={cn('text-xs', v > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground')}>
          {v}
        </span>
      );
    },
  },
];

export function JobsTable({
  data,
  globalFilter,
  onRetry,
  onCancel,
  onViewArtifact,
  onViewPrompt,
  onDelete,
}: JobsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="bg-muted/50">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs font-medium cursor-pointer select-none whitespace-nowrap"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground text-sm py-12">
                No jobs found
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                <TableCell className="py-2">
                  <JobActionMenu
                    jobId={row.original.id}
                    onRetry={onRetry}
                    onCancel={onCancel}
                    onViewArtifact={onViewArtifact}
                    onViewPrompt={onViewPrompt}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
