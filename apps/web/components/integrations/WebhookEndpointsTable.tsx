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
import { Send, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { WebhookEditDialog } from './WebhookEditDialog';

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
  lastDelivery: string;
  status: 'success' | 'error' | 'pending';
}

const STUB_WEBHOOKS: WebhookRow[] = [
  {
    id: 'wh1',
    url: 'https://hooks.example.com/worldfork',
    secret: 'whsec_abc123',
    events: ['run.created', 'tick.completed'],
    lastDelivery: '2 min ago',
    status: 'success',
  },
  {
    id: 'wh2',
    url: 'https://alerts.internal/wf',
    secret: 'whsec_xyz789',
    events: ['job.failed', 'branch.killed'],
    lastDelivery: '1 hr ago',
    status: 'error',
  },
];

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const col = createColumnHelper<WebhookRow>();

export function WebhookEndpointsTable() {
  const [editTarget, setEditTarget] = React.useState<WebhookRow | null>(null);

  const sendTest = async (url: string) => {
    toast.promise(new Promise((r) => setTimeout(r, 500)), {
      loading: 'Sending test…',
      success: `Test sent to ${url}`,
      error: 'Send failed.',
    });
  };

  const columns = [
    col.accessor('url', {
      header: 'URL',
      cell: (info) => (
        <span className="font-mono text-xs truncate max-w-[220px] block">{info.getValue()}</span>
      ),
    }),
    col.accessor('secret', {
      header: 'Secret',
      cell: () => <span className="font-mono text-xs">••••••••</span>,
    }),
    col.accessor('events', {
      header: 'Events',
      cell: (info) => (
        <div className="flex flex-wrap gap-1">
          {info.getValue().map((e) => (
            <Badge key={e} variant="outline" className="text-xs">
              {e}
            </Badge>
          ))}
        </div>
      ),
    }),
    col.accessor('lastDelivery', { header: 'Last Delivery' }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[info.getValue()]}`}>
          {info.getValue()}
        </Badge>
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
            onClick={() => sendTest(row.original.url)}
            title="Send test"
          >
            <Send className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setEditTarget(row.original)}
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: STUB_WEBHOOKS,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
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

      <WebhookEditDialog
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        initial={editTarget ?? undefined}
      />
    </>
  );
}
