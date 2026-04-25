'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'dead';

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const STATUS_STYLES: Record<JobStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  running:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  success:   'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  failed:    'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  retrying:  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  dead:      'bg-red-200 text-red-900 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900',
};

const STATUS_LABELS: Record<JobStatus, string> = {
  pending:   'Pending',
  running:   'Running',
  success:   'Success',
  failed:    'Failed',
  retrying:  'Retrying',
  cancelled: 'Cancelled',
  dead:      'Dead',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium capitalize',
        STATUS_STYLES[status] ?? STATUS_STYLES.pending,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
