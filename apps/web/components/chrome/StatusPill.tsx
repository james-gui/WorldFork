import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusValue =
  | 'active'
  | 'running'
  | 'paused'
  | 'frozen'
  | 'killed'
  | 'candidate'
  | 'merged'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'degraded';

const statusConfig: Record<
  StatusValue,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  running: {
    label: 'Running',
    className: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  frozen: {
    label: 'Frozen',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  killed: {
    label: 'Killed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  candidate: {
    label: 'Candidate',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  merged: {
    label: 'Merged',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  pending: {
    label: 'Pending',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  degraded: {
    label: 'Degraded',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

interface StatusPillProps {
  status: StatusValue;
  className?: string;
  showDot?: boolean;
}

export function StatusPill({ status, className, showDot = true }: StatusPillProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status === 'running' || status === 'active'
              ? 'animate-pulse bg-current'
              : 'bg-current opacity-70'
          )}
        />
      )}
      {config.label}
    </span>
  );
}
