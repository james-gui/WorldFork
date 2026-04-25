'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RotateCcw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DEFAULT_ROUTING_ROWS,
  isGodTierJobType,
  RoutingPoliciesTable,
  type RoutingPolicyRow,
} from '@/components/routing/RoutingPoliciesTable';
import { GlobalRoutingSettingsCard } from '@/components/routing/GlobalRoutingSettingsCard';
import { RoutingUsageCard } from '@/components/routing/RoutingUsageCard';
import { QuotaPressureCard } from '@/components/routing/QuotaPressureCard';
import { CostBurnCard } from '@/components/routing/CostBurnCard';
import { AlertsCard } from '@/components/routing/AlertsCard';
import { usePatchRouting, useRouting } from '@/lib/api/settings';
import type { RoutingEntryResponse } from '@/lib/api/types';

function rowFromEntry(entry: RoutingEntryResponse): RoutingPolicyRow {
  return {
    jobType: entry.job_type as RoutingPolicyRow['jobType'],
    provider: entry.preferred_provider,
    model: entry.preferred_model,
    temperature: entry.temperature,
    topP: entry.top_p,
    maxTokens: entry.max_tokens,
    concurrency: entry.max_concurrency,
    rpm: entry.requests_per_minute,
    tpm: entry.tokens_per_minute,
    dailyCap: entry.daily_budget_usd ?? 0,
  };
}

export default function RoutingPage() {
  const { mutateAsync, isPending } = usePatchRouting();
  const { data: routing } = useRouting();
  const [rows, setRows] = React.useState<RoutingPolicyRow[]>(DEFAULT_ROUTING_ROWS);

  React.useEffect(() => {
    if (routing?.entries?.length) {
      setRows(routing.entries.map(rowFromEntry));
    }
  }, [routing]);

  const handleSave = async () => {
    try {
      await mutateAsync({
        entries: rows.map((row) => {
          const fallbackModel =
            isGodTierJobType(row.jobType)
              ? (row.model === 'openai/gpt-5.4' ? null : 'openai/gpt-5.4')
              : (row.model === 'openai/gpt-4o-mini' ? null : 'openai/gpt-4o-mini');
          return {
            job_type: row.jobType,
            preferred_provider: row.provider,
            preferred_model: row.model,
            fallback_provider: fallbackModel ? 'openrouter' : null,
            fallback_model: fallbackModel,
            temperature: row.temperature,
            top_p: row.topP,
            max_tokens: row.maxTokens,
            max_concurrency: row.concurrency,
            requests_per_minute: row.rpm,
            tokens_per_minute: row.tpm,
            timeout_seconds: 120,
            retry_policy: 'exponential_backoff',
            daily_budget_usd: row.dailyCap || null,
            payload: {
              source: 'routing_settings_ui',
            },
          };
        }),
      });
      toast.success('Routing settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save routing settings.');
    }
  };

  const handleReset = () => {
    setRows(DEFAULT_ROUTING_ROWS);
    toast.info('Routing settings reset to defaults.');
  };

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Model Routing &amp; Rate Limits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure routing preferences, fallback, and rate-limiting policies for each job type.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Default
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSave} disabled={isPending}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Two-column layout: main + right sidebar */}
      <div className="flex gap-6 items-start">
        {/* Left / main: policies table + global settings */}
        <div className="flex-1 min-w-0 space-y-6">
          <section>
            <h2 className="text-sm font-semibold mb-3">Model Routing Policies</h2>
            <RoutingPoliciesTable rows={rows} onRowsChange={setRows} />
          </section>

          <GlobalRoutingSettingsCard />
        </div>

        {/* Right sidebar: 4 stacked cards */}
        <aside className="w-72 shrink-0 space-y-4">
          <RoutingUsageCard />
          <QuotaPressureCard />
          <CostBurnCard />
          <AlertsCard />
        </aside>
      </div>
    </div>
  );
}
