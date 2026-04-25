'use client';

import * as React from 'react';

interface PromptSummary {
  promptHash: string;
  model: string;
  cost: number;
  tokens: { prompt: number; completion: number };
  toolCalls: number;
  provider: string;
  traceId: string;
}

interface PromptSummaryCardProps {
  summary: PromptSummary;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/60 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground truncate ml-2 max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}

export function PromptSummaryCard({ summary }: PromptSummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Prompt Snapshot Summary</p>
      </div>
      <div className="px-3 py-2">
        <Row label="Top hash" value={summary.promptHash} />
        <Row label="Model used" value={summary.model} />
        <Row label="Cost" value={`$${summary.cost.toFixed(4)}`} />
        <Row
          label="Tokens"
          value={`${summary.tokens.prompt.toLocaleString()} / ${summary.tokens.completion.toLocaleString()}`}
        />
        <Row label="Tool calls" value={summary.toolCalls} />
        <Row
          label="Provider / Trace"
          value={
            <span title={summary.traceId}>
              {summary.provider} · {summary.traceId.slice(0, 12)}…
            </span>
          }
        />
      </div>
    </div>
  );
}
