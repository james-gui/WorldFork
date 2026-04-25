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

interface ProviderRow {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  latency: string;
  rpm: number;
  tpm: number;
  dailyCap: number;
  priority: number;
  enabled: boolean;
}

const STUB_ROWS: ProviderRow[] = [
  { id: 'openrouter', name: 'OpenRouter', status: 'connected', latency: '480ms', rpm: 500, tpm: 200000, dailyCap: 5000000, priority: 1, enabled: true },
  { id: 'openai', name: 'OpenAI', status: 'disconnected', latency: '—', rpm: 0, tpm: 0, dailyCap: 0, priority: 2, enabled: false },
  { id: 'anthropic', name: 'Anthropic', status: 'disconnected', latency: '—', rpm: 0, tpm: 0, dailyCap: 0, priority: 3, enabled: false },
  { id: 'ollama', name: 'Ollama', status: 'disconnected', latency: '—', rpm: 0, tpm: 0, dailyCap: 0, priority: 4, enabled: false },
  { id: 'zep', name: 'Zep', status: 'connected', latency: '120ms', rpm: 1000, tpm: 0, dailyCap: 0, priority: 5, enabled: true },
];

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  disconnected: 'bg-muted text-muted-foreground',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const col = createColumnHelper<ProviderRow>();

export function ProviderPriorityTable() {
  const [data, setData] = React.useState<ProviderRow[]>(STUB_ROWS);

  const toggleEnabled = (id: string) => {
    setData((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const columns = [
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
    col.accessor('latency', { header: 'Latency' }),
    col.accessor('rpm', {
      header: 'RPM',
      cell: (info) => info.getValue().toLocaleString(),
    }),
    col.accessor('tpm', {
      header: 'TPM',
      cell: (info) => info.getValue().toLocaleString(),
    }),
    col.accessor('dailyCap', {
      header: 'Daily Cap',
      cell: (info) => (info.getValue() ? info.getValue().toLocaleString() : '—'),
    }),
    col.accessor('priority', { header: 'Priority' }),
    col.accessor('enabled', {
      header: 'Enabled',
      cell: (info) => (
        <Switch
          checked={info.getValue()}
          onCheckedChange={() => toggleEnabled(info.row.original.id)}
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
        </TableBody>
      </Table>
    </div>
  );
}
