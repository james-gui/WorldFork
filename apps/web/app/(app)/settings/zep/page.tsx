'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { ZepConnectionCard } from '@/components/zep/ZepConnectionCard';
import { ZepMemoryMapCard, type MemoryMode } from '@/components/zep/ZepMemoryMapCard';
import { ZepSettingsCard, type ZepSettings } from '@/components/zep/ZepSettingsCard';
import { MappingsTable, type ZepMapping } from '@/components/zep/MappingsTable';
import { IngestionStatusCard } from '@/components/zep/IngestionStatusCard';
import { CycleWarmingCard } from '@/components/zep/CycleWarmingCard';
import { usePatchZep, useZepStatus } from '@/lib/api/integrations';

const LOCAL_LEDGER_MAPPINGS: ZepMapping[] = [];

const DEFAULT_SETTINGS: ZepSettings = {
  cacheTtl: 300,
  defaultSummaryLevel: 'standard',
  healthcheckInterval: 30,
  maxSearchResults: 20,
  embedMode: false,
};

/* ─── Page ────────────────────────────────────────────────────────── */

export default function ZepPage() {
  const [url, setUrl] = useState('https://api.getzep.com');
  const [region, setRegion] = useState('us-east-1');
  const [memoryMode, setMemoryMode] = useState<MemoryMode>('local_ledger');
  const [settings, setSettings] = useState<ZepSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('mappings');
  const { data: zepStatus } = useZepStatus();
  const patchZep = usePatchZep();

  async function handleSave() {
    try {
      await patchZep.mutateAsync({
        enabled: false,
        mode: 'local',
        api_key_env: 'ZEP_API_KEY',
        cache_ttl_seconds: settings.cacheTtl,
        payload: {
          region,
          url,
          memory_mode: 'local_ledger',
          zep_enabled: false,
        },
      });
      toast.success('Local ledger memory saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save memory settings.');
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Zep Memory Integration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Zep is disabled for this deployment. WorldFork is using local ledger summaries.
          </p>
        </div>
        <Button onClick={handleSave} disabled={patchZep.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save local mode
        </Button>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
        Memory mode: {zepStatus?.mode ?? 'local'}; Zep enabled: {String(zepStatus?.enabled ?? false)}.
      </div>

      {/* Top cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ZepConnectionCard
          url={url}
          onUrlChange={setUrl}
          region={region}
          onRegionChange={setRegion}
          disabledMode
        />
        <ZepMemoryMapCard mode={memoryMode} onModeChange={setMemoryMode} disabled />
        <ZepSettingsCard settings={settings} onChange={setSettings} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="threads">Threads</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Mappings tab */}
        <TabsContent value="mappings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main mappings table */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <h2 className="text-sm font-medium mb-1">Cohort / Hero Mapping</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Zep mapping is intentionally empty. Cohort and hero summaries stay in local run ledgers.
                </p>
                <MappingsTable
                  data={LOCAL_LEDGER_MAPPINGS}
                  onResync={(id) => toast.info(`Local memory refresh requested for ${id.slice(0, 12)}...`)}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <IngestionStatusCard queueDepth={0} lastSync="Disabled" successRate={0} />
              <CycleWarmingCard />
            </div>
          </div>
        </TabsContent>

        {/* Threads tab */}
        <TabsContent value="threads" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            Zep thread storage is disabled. Use review artifacts and tick ledgers for memory inspection.
          </div>
        </TabsContent>

        {/* Graph tab */}
        <TabsContent value="graph" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
              Zep graph sync is disabled for this deployment.
            </div>
            <div className="space-y-4">
              <IngestionStatusCard queueDepth={0} lastSync="Disabled" successRate={0} />
            </div>
          </div>
        </TabsContent>

        {/* Search tab */}
        <TabsContent value="search" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            Semantic Zep search is unavailable while local ledger memory is active.
          </div>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            No Zep sync history is produced while Zep is disabled.
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Bottom info banner + docs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-950/20 dark:border-brand-800 p-4">
          <AlertCircle className="h-4 w-4 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-brand-800 dark:text-brand-300 space-y-1">
            <p className="font-medium">Local ledger memory is live during simulation</p>
            <p>
              Cohort and hero memory summaries are stored in run artifacts. Zep calls remain
              disabled unless ZEP_ENABLED is explicitly set true with a configured key.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
          Zep remains an optional integration surface. This local deploy keeps it off and routes memory through run artifacts.
        </div>
      </div>
    </div>
  );
}
