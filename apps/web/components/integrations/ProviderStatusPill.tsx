'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'testing';

interface ProviderStatusPillProps {
  status: ProviderStatus;
}

const STATUS_CONFIG: Record<ProviderStatus, { label: string; className: string }> = {
  connected: {
    label: 'Connected',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  disconnected: {
    label: 'Disconnected',
    className: 'bg-muted text-muted-foreground',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  testing: {
    label: 'Testing…',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

export function ProviderStatusPill({ status }: ProviderStatusPillProps) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  );
}
