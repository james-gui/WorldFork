'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { RotateCcw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SaveBar } from '@/components/settings/SaveBar';
import { BackendProviderCard } from '@/components/settings/BackendProviderCard';
import { ModelsCard } from '@/components/settings/ModelsCard';
import { PromptParametersCard } from '@/components/settings/PromptParametersCard';
import { SociologyPresetsCard } from '@/components/settings/SociologyPresetsCard';
import { SoTSnapshotsCard } from '@/components/settings/SoTSnapshotsCard';
import { MemoryCard } from '@/components/settings/MemoryCard';
import { OASISAdapterCard } from '@/components/settings/OASISAdapterCard';
import { PreferencesCard } from '@/components/settings/PreferencesCard';
import { usePatchProviders, usePatchSettings, useProviders, useSettings } from '@/lib/api/settings';

const settingsSchema = z.object({
  // Backend provider
  provider: z.string().default('openrouter'),
  baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  apiKeyEnv: z.string().default('OPENROUTER_API_KEY'),
  // Models
  defaultModel: z.string().default('deepseek/deepseek-v3.2'),
  fallbackModel: z.string().default('openai/gpt-4o-mini'),
  capabilityTest: z.boolean().default(false),
  toolCalling: z.boolean().default(true),
  structuredOutput: z.boolean().default(true),
  // Prompt parameters
  temperature: z.number().min(0).max(1).default(0.7),
  topP: z.number().min(0).max(1).default(1),
  maxOutputTokens: z.number().int().positive().default(4096),
  contextWindowTokens: z.number().int().positive().default(128000),
  // Sociology
  beliefDriftEta: z.number().min(0).max(1).default(0.15),
  mobilizationThreshold: z.number().min(0).max(1).default(0.6),
  spiralSilenceIsolation: z.number().min(0).max(1).default(0.3),
  // SoT
  sotApplyPerRun: z.boolean().default(true),
  // Memory
  memoryProvider: z.string().default('local_ledger'),
  memoryMode: z.string().default('local'),
  memoryCacheTtl: z.number().default(30),
  // OASIS
  oasisEnabled: z.boolean().default(false),
  // Preferences
  theme: z.string().default('system'),
  dateFormat: z.string().default('MM/dd/yyyy'),
  tickClockDisplay: z.string().default('relative'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const SECTION_ANCHORS = [
  { label: 'Backend Provider', id: 'backend-provider' },
  { label: 'Models', id: 'models' },
  { label: 'Prompt Parameters', id: 'prompt-parameters' },
  { label: 'Sociology Presets', id: 'sociology-presets' },
  { label: 'SoT Snapshots', id: 'sot-snapshots' },
  { label: 'Memory', id: 'memory' },
  { label: 'OASIS Adapter', id: 'oasis-adapter' },
  { label: 'Preferences', id: 'preferences' },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export default function SettingsPage() {
  const { mutateAsync, isPending } = usePatchSettings();
  const { mutateAsync: patchProviders, isPending: providersPending } = usePatchProviders();
  const { data: settingsData } = useSettings();
  const { data: providersData } = useProviders();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsSchema.parse({}),
  });

  const isDirty = form.formState.isDirty;

  React.useEffect(() => {
    if (isDirty) return;
    const provider = providersData?.providers.find((row) => row.provider === 'openrouter')
      ?? providersData?.providers[0];
    const payload = settingsData?.payload ?? {};
    const preferences = payload.preferences && typeof payload.preferences === 'object'
      ? payload.preferences as Record<string, unknown>
      : {};
    form.reset(settingsSchema.parse({
      provider: provider?.provider ?? stringValue(payload.provider),
      baseUrl: provider?.base_url ?? stringValue(payload.base_url),
      apiKeyEnv: provider?.api_key_env ?? stringValue(payload.api_key_env),
      defaultModel: provider?.default_model ?? stringValue(payload.default_model),
      fallbackModel: provider?.fallback_model ?? stringValue(payload.fallback_model),
      toolCalling: provider?.tool_calling_enabled ?? booleanValue(payload.tool_calling),
      structuredOutput: provider?.json_mode_required ?? booleanValue(payload.structured_output),
      temperature: numberValue(payload.temperature),
      topP: numberValue(payload.top_p),
      maxOutputTokens: numberValue(payload.max_output_tokens),
      contextWindowTokens: numberValue(payload.context_window_tokens),
      sotApplyPerRun: booleanValue(payload.sot_apply_per_run),
      memoryProvider: stringValue(payload.memory_provider),
      memoryMode: stringValue(payload.memory_mode),
      memoryCacheTtl: numberValue(payload.memory_cache_ttl),
      oasisEnabled: settingsData?.enable_oasis_adapter,
      theme: settingsData?.theme,
      dateFormat: stringValue(preferences.date_format),
      tickClockDisplay: stringValue(preferences.tick_clock_display),
    }));
  }, [form, isDirty, providersData, settingsData]);

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      await patchProviders({
        providers: [
          {
            provider: values.provider,
            base_url: values.baseUrl,
            api_key_env: values.apiKeyEnv,
            default_model: values.defaultModel,
            fallback_model: values.fallbackModel,
            json_mode_required: values.structuredOutput,
            tool_calling_enabled: values.toolCalling,
            enabled: true,
            extra_headers: {},
            payload: {
              source: 'settings_overview',
            },
          },
        ],
      });
      await mutateAsync({
        default_max_ticks: 180,
        default_tick_duration_minutes: 1440,
        theme: values.theme,
        enable_oasis_adapter: values.oasisEnabled,
        payload: {
          provider: values.provider,
          base_url: values.baseUrl,
          api_key_env: values.apiKeyEnv,
          default_model: values.defaultModel,
          fallback_model: values.fallbackModel,
          temperature: values.temperature,
          top_p: values.topP,
          max_output_tokens: values.maxOutputTokens,
          context_window_tokens: values.contextWindowTokens,
          sot_apply_per_run: values.sotApplyPerRun,
          memory_provider: values.memoryProvider,
          memory_mode: values.memoryMode,
          zep_enabled: false,
          preferences: {
            date_format: values.dateFormat,
            tick_clock_display: values.tickClockDisplay,
          },
        },
      });
      form.reset(values);
      toast.success('Settings saved successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const onReset = () => {
    form.reset(settingsSchema.parse({}));
    toast.info('Settings reset to defaults.');
  };

  const onDiscard = () => {
    form.reset();
    toast.info('Changes discarded.');
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full">
        {/* Section anchor sidebar */}
        <aside className="hidden xl:flex flex-col w-48 shrink-0 border-r border-border px-3 py-6 gap-1 sticky top-0 h-screen overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Sections
          </p>
          {SECTION_ANCHORS.map((anchor) => (
            <button
              key={anchor.id}
              type="button"
              onClick={() => scrollTo(anchor.id)}
              className="text-left text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {anchor.label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 pb-24 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Settings &amp; Configuration
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure the simulation engine, models, parameters, and repositories that power your worlds.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onReset}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Default
                </Button>
                <Button type="submit" size="sm" className="gap-1.5" disabled={isPending || providersPending}>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </Button>
              </div>
            </div>

            {/* 2-column card grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BackendProviderCard />
              <ModelsCard />
              <PromptParametersCard />
              <SociologyPresetsCard />
              <SoTSnapshotsCard />
              <MemoryCard />
              <OASISAdapterCard />
              <PreferencesCard />
            </div>
          </div>
        </div>

        {/* Sticky save bar for unsaved changes */}
        <SaveBar
          visible={isDirty}
          onSave={form.handleSubmit(onSubmit)}
          onDiscard={onDiscard}
          isLoading={isPending || providersPending}
        />
      </form>
    </FormProvider>
  );
}
