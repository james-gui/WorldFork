'use client';

import * as React from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GripVertical } from 'lucide-react';

export interface ProviderPriorityRow {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number | null;
  rpm: number;
  tpm: number;
  dailyCap?: number | null;
  priority: number;
  enabled: boolean;
  readonly?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  disconnected: 'bg-muted text-muted-foreground',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const col = createColumnHelper<ProviderPriorityRow>();

function formatNumber(value: number | null | undefined) {
  return value ? value.toLocaleString() : '0';
}

export function ProviderPriorityTable({
  rows,
  onEnabledChange,
}: {
  rows: ProviderPriorityRow[];
  onEnabledChange?: (providerId: string, enabled: boolean) => void;
}) {
  const columns = React.useMemo(
    () => [
      col.display({
        id: 'drag',
        header: '',
        cell: () => (
          <span className="cursor-grab text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </span>
        ),
        size: 32,
      }),
      col.accessor('name', { header: 'Provider' }),
      col.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[info.getValue()]}`}>
            {info.getValue()}
          </Badge>
        ),
      }),
      col.accessor('latencyMs', {
        header: 'Latency',
        cell: (info) => {
          const value = info.getValue();
          return value === null || value === undefined ? 'Not tested' : `${value}ms`;
        },
      }),
      col.accessor('rpm', {
        header: 'RPM',
        cell: (info) => formatNumber(info.getValue()),
      }),
      col.accessor('tpm', {
        header: 'TPM',
        cell: (info) => formatNumber(info.getValue()),
      }),
      col.accessor('dailyCap', {
        header: 'Daily Cap',
        cell: (info) => (info.getValue() ? `$${info.getValue()!.toLocaleString()}` : 'None'),
      }),
      col.accessor('priority', { header: 'Priority' }),
      col.accessor('enabled', {
        header: 'Enabled',
        cell: (info) => (
          <Switch
            checked={info.getValue()}
            disabled={info.row.original.readonly || !onEnabledChange}
            onCheckedChange={(checked) => onEnabledChange?.(info.row.original.id, checked)}
          />
        ),
      }),
    ],
    [onEnabledChange],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="text-xs h-8">
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
                <TableCell key={cell.id} className="text-xs py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-xs text-muted-foreground py-6 text-center">
                No provider settings returned by the API.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
