'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RefreshCw, Save, Lock, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProviderCard } from '@/components/integrations/ProviderCard';
import {
  ProviderPriorityTable,
  type ProviderPriorityRow,
} from '@/components/integrations/ProviderPriorityTable';
import { WebhookEndpointsTable } from '@/components/integrations/WebhookEndpointsTable';
import { WebhookEditDialog } from '@/components/integrations/WebhookEditDialog';
import { usePatchProviders, useProviders, useRateLimits, useTestProvider } from '@/lib/api/settings';

const PROVIDERS = [
  {
    id: 'openrouter' as const,
    name: 'OpenRouter',
    status: 'connected' as const,
    defaultModel: 'deepseek/deepseek-v3.2',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'google/gemini-3.1-flash-lite-preview',
      'deepseek/deepseek-v3.2',
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash',
      'openai/gpt-5.5',
      'openai/gpt-5.4',
      'openai/gpt-4o-mini',
    ],
  },
];

export default function IntegrationsPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [newWebhookOpen, setNewWebhookOpen] = React.useState(false);
  const [providerEdits, setProviderEdits] = React.useState<Record<string, { defaultModel: string; baseUrl: string; enabled?: boolean }>>({});
  const { data: providersData, refetch } = useProviders();
  const { data: rateLimits } = useRateLimits();
  const patchProviders = usePatchProviders();
  const testProvider = useTestProvider();

  const providers = React.useMemo(() => {
    const byId = new Map(
      (providersData?.providers ?? []).map((provider) => [provider.provider, provider]),
    );
    return PROVIDERS.map((provider) => {
      const row = byId.get(provider.id);
      const edit = providerEdits[provider.id];
      const enabled = edit?.enabled ?? row?.enabled ?? provider.id === 'openrouter';
      return {
        ...provider,
        status: enabled ? ('connected' as const) : ('disconnected' as const),
        enabled,
        defaultModel: edit?.defaultModel ?? row?.default_model ?? provider.defaultModel,
        baseUrl: edit?.baseUrl ?? row?.base_url ?? provider.baseUrl,
      };
    });
  }, [providersData, providerEdits]);

  const priorityRows = React.useMemo<ProviderPriorityRow[]>(() => {
    const limitsByProvider = new Map(
      (rateLimits?.rate_limits ?? []).map((row) => [row.provider, row]),
    );
    return providers.map((provider, index) => {
      const limit = limitsByProvider.get(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        status: provider.status,
        latencyMs: null,
        rpm: limit?.rpm_limit ?? 0,
        tpm: limit?.tpm_limit ?? 0,
        dailyCap: limit?.daily_budget_usd ?? null,
        priority: index + 1,
        enabled: provider.enabled,
      };
    });
  }, [providers, rateLimits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Integration status refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    try {
      await patchProviders.mutateAsync({
        providers: providers
          .map((provider) => ({
            provider: provider.id,
            base_url: provider.baseUrl,
            api_key_env: 'OPENROUTER_API_KEY',
            default_model: provider.defaultModel || 'deepseek/deepseek-v3.2',
            fallback_model: 'openai/gpt-4o-mini',
            json_mode_required: true,
            tool_calling_enabled: true,
            enabled: provider.enabled,
            extra_headers: {},
            payload: {},
          })),
      });
      toast.success('Integration settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save integrations.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Integrations &amp; API Providers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure API providers and webhooks used by your simulations.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Provider cards */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Providers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              {...p}
              onTest={async () => {
                const result = await testProvider.mutateAsync({
                  provider: p.id,
                  model: p.defaultModel || null,
                });
                if (!result.ok) throw new Error(result.error ?? 'Provider test failed.');
              }}
              onChange={(value) =>
                setProviderEdits((prev) => ({
                  ...prev,
                  [p.id]: {
                    ...value,
                    enabled: prev[p.id]?.enabled ?? p.enabled,
                  },
                }))
              }
            />
          ))}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Local Ledger Memory</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Zep is disabled for this deployment. Review context is read from immutable run
              ledgers and local summaries.
            </p>
          </div>
        </div>
      </section>

      {/* Provider Priority & Fallback Order */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Provider Priority &amp; Fallback Order</h2>
        </div>
        <ProviderPriorityTable
          rows={priorityRows}
          onEnabledChange={(providerId, enabled) => {
            const provider = providers.find((p) => p.id === providerId);
            if (!provider) return;
            setProviderEdits((prev) => ({
              ...prev,
              [providerId]: {
                defaultModel: prev[providerId]?.defaultModel ?? provider.defaultModel,
                baseUrl: prev[providerId]?.baseUrl ?? provider.baseUrl,
                enabled,
              },
            }));
          }}
        />
      </section>

      {/* Webhook Endpoints */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Webhook Endpoints</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setNewWebhookOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Send test
          </Button>
        </div>
        <WebhookEndpointsTable />
      </section>

      {/* Footer info banner */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 flex-shrink-0" />
        Provider rows reference environment variable names only. API key values stay outside the UI and are never returned by the API.
      </div>

      <WebhookEditDialog
        open={newWebhookOpen}
        onOpenChange={setNewWebhookOpen}
      />
    </div>
  );
}
