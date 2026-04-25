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
import { usePatchSettings } from '@/lib/api/settings';

const settingsSchema = z.object({
  // Backend provider
  provider: z.string().default('openrouter'),
  baseUrl: z.string().default('https://openrouter.ai/api/v1'),
  apiKeyEnv: z.string().default('OPENROUTER_API_KEY'),
  // Models
  defaultModel: z.string().default('openai/gpt-4o'),
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
  memoryProvider: z.string().default('zep'),
  memoryMode: z.string().default('hybrid'),
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

export default function SettingsPage() {
  const { mutateAsync, isPending } = usePatchSettings();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsSchema.parse({}),
  });

  const isDirty = form.formState.isDirty;

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      // Stub: simulate a 200ms save
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      void mutateAsync(values).catch(() => {});
      form.reset(values);
      toast.success('Settings saved successfully.');
    } catch {
      toast.error('Failed to save settings.');
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
                <Button type="submit" size="sm" className="gap-1.5" disabled={isPending}>
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
          isLoading={isPending}
        />
      </form>
    </FormProvider>
  );
}
