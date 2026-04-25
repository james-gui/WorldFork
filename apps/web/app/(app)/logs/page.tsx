'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLogs, useWebhookLogs, useErrorLogs } from '@/lib/api/logs';
import type { RequestLogItem, WebhookLogItem, ErrorLogItem } from '@/lib/api/types';

export default function LogsPage() {
  const [selected, setSelected] = React.useState<Record<string, unknown> | null>(null);
  const { data: requestLogs } = useLogs({ limit: 100 });
  const { data: webhookLogs } = useWebhookLogs({ limit: 50 });
  const { data: errorLogs } = useErrorLogs({ limit: 50 });

  const requests = requestLogs ?? [];
  const webhooks = webhookLogs ?? [];
  const errors = errorLogs ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Logs &amp; Webhooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect provider requests, webhook delivery, and background failures.
        </p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4">
          <RequestsTable rows={requests} onSelect={setSelected} />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTable rows={webhooks} onSelect={setSelected} />
        </TabsContent>
        <TabsContent value="errors" className="mt-4">
          <ErrorsTable rows={errors} onSelect={setSelected} />
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Log Detail</SheetTitle>
            <SheetDescription>Raw row payload from the log stream.</SheetDescription>
          </SheetHeader>
          <pre className="mt-4 max-h-[70vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RequestsTable({
  rows,
  onSelect,
}: {
  rows: RequestLogItem[];
  onSelect: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Call</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.call_id} className="cursor-pointer" onClick={() => onSelect(row as unknown as Record<string, unknown>)}>
              <TableCell className="font-mono text-xs">{row.call_id}</TableCell>
              <TableCell>{row.provider}</TableCell>
              <TableCell>{row.job_type}</TableCell>
              <TableCell>{row.total_tokens.toLocaleString()}</TableCell>
              <TableCell>{row.latency_ms}ms</TableCell>
              <TableCell>
                <Badge variant="outline">{row.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WebhooksTable({
  rows,
  onSelect,
}: {
  rows: WebhookLogItem[];
  onSelect: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Attempts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onSelect(row as unknown as Record<string, unknown>)}>
              <TableCell>{row.event_type}</TableCell>
              <TableCell className="max-w-md truncate">{row.target_url}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.attempts}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ErrorsTable({
  rows,
  onSelect,
}: {
  rows: ErrorLogItem[];
  onSelect: (row: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" onClick={() => onSelect(row as unknown as Record<string, unknown>)}>
              <TableCell>{row.source}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell className="max-w-xl truncate">{row.error}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
