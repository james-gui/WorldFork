'use client';

import * as React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ToolCall {
  id: string;
  name: string;
  status: 'success' | 'error' | 'skipped';
  args: Record<string, any>;
}

interface ToolCallsListProps {
  toolCalls: ToolCall[];
}

const STATUS_PILL: Record<ToolCall['status'], string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  skipped: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function ToolCallsList({ toolCalls }: ToolCallsListProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Tool Calls</p>
      </div>
      <ul className="divide-y divide-border">
        {toolCalls.map((tc) => (
          <li key={tc.id} className="px-3 py-2 flex items-center gap-2">
            <span className="text-xs font-mono font-medium flex-1 truncate">
              {tc.name}
            </span>
            <span
              className={cn(
                'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border',
                STATUS_PILL[tc.status]
              )}
            >
              {tc.status}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 gap-1 text-[10px]"
                >
                  <Eye className="h-3 w-3" />
                  args
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-2 text-[11px] font-mono"
              >
                <pre className="whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                  {JSON.stringify(tc.args, null, 2)}
                </pre>
              </PopoverContent>
            </Popover>
          </li>
        ))}
        {toolCalls.length === 0 && (
          <li className="px-3 py-4 text-xs text-muted-foreground text-center">
            No tool calls.
          </li>
        )}
      </ul>
    </div>
  );
}
