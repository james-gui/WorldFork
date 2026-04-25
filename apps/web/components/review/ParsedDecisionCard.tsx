'use client';

import * as React from 'react';
import { JsonViewer } from '@/components/code/JsonViewer';

interface ParsedDecisionCardProps {
  decision: Record<string, any>;
  height?: string;
}

export function ParsedDecisionCard({
  decision,
  height = '240px',
}: ParsedDecisionCardProps) {
  const value = React.useMemo(() => JSON.stringify(decision, null, 2), [decision]);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Parsed Decision</p>
      </div>
      <div className="bg-[#1e1e1e]">
        <JsonViewer value={value} height={height} />
      </div>
    </div>
  );
}
