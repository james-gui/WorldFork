'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RefreshCw, Save, Lock, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProviderCard } from '@/components/integrations/ProviderCard';
import { ProviderPriorityTable } from '@/components/integrations/ProviderPriorityTable';
import { WebhookEndpointsTable } from '@/components/integrations/WebhookEndpointsTable';
import { WebhookEditDialog } from '@/components/integrations/WebhookEditDialog';

const PROVIDERS = [
  {
    id: 'openrouter' as const,
    name: 'OpenRouter',
    status: 'connected' as const,
    defaultModel: 'openai/gpt-4o',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet'],
  },
  {
    id: 'openai' as const,
    name: 'OpenAI',
    status: 'disconnected' as const,
    defaultModel: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic',
    status: 'disconnected' as const,
    defaultModel: 'claude-3-5-sonnet-20241022',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  },
  {
    id: 'ollama' as const,
    name: 'Ollama',
    status: 'disconnected' as const,
    defaultModel: 'llama3',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'mistral', 'codellama'],
  },
  {
    id: 'zep' as const,
    name: 'Zep',
    status: 'connected' as const,
    defaultModel: '',
    baseUrl: 'https://api.getzep.com',
    models: [],
  },
];

export default function IntegrationsPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [newWebhookOpen, setNewWebhookOpen] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success('Integration status refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    await new Promise((r) => setTimeout(r, 200));
    toast.success('Integration settings saved.');
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

      {/* Provider cards — 5 columns */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Providers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {PROVIDERS.map((p) => (
            <ProviderCard key={p.id} {...p} />
          ))}
        </div>
      </section>

      {/* Provider Priority & Fallback Order */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Provider Priority &amp; Fallback Order</h2>
        </div>
        <ProviderPriorityTable />
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
            Add endpoint
          </Button>
        </div>
        <WebhookEndpointsTable />
      </section>

      {/* Footer info banner */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 flex-shrink-0" />
        All credentials are encrypted and stored securely. Keys are never logged or transmitted in plain text.
      </div>

      <WebhookEditDialog
        open={newWebhookOpen}
        onOpenChange={setNewWebhookOpen}
      />
    </div>
  );
}
