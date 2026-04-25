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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useReplayWebhook, useWebhookLogs } from '@/lib/api/logs';
import type { WebhookLogItem } from '@/lib/api/types';

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const col = createColumnHelper<WebhookLogItem>();

export function WebhookEndpointsTable() {
  const { data: rows = [] } = useWebhookLogs({ limit: 50 });
  const replayWebhook = useReplayWebhook();

  const replay = async (eventId: string) => {
    toast.promise(replayWebhook.mutateAsync({ event_id: eventId }), {
      loading: 'Replaying webhook...',
      success: 'Webhook replay completed.',
      error: (err) => err instanceof Error ? err.message : 'Webhook replay failed.',
    });
  };

  const columns = [
    col.accessor('target_url', {
      header: 'URL',
      cell: (info) => (
        <span className="font-mono text-xs truncate max-w-[220px] block">{info.getValue()}</span>
      ),
    }),
    col.accessor('event_type', {
      header: 'Event',
      cell: (info) => <Badge variant="outline" className="text-xs">{info.getValue()}</Badge>,
    }),
    col.accessor('attempts', {
      header: 'Attempts',
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    col.accessor('last_delivered_at', {
      header: 'Last Delivery',
      cell: (info) => {
        const value = info.getValue() ?? info.row.original.created_at;
        return <span className="text-xs">{new Date(value).toLocaleString()}</span>;
      },
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[info.getValue()] ?? 'bg-muted text-muted-foreground'}`}>
          {info.getValue()}
        </Badge>
      ),
    }),
    col.accessor('error', {
      header: 'Error',
      cell: (info) => (
        <span className="text-xs text-muted-foreground truncate max-w-[180px] block">
          {info.getValue() || 'None'}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => replay(row.original.id)}
            disabled={replayWebhook.isPending}
            title="Replay"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      ),
    }),
  ];

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
                No webhook deliveries have been recorded.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
