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
import { ZepDocsCard } from '@/components/zep/ZepDocsCard';
import { ZepGraphPreview } from '@/components/zep/ZepGraphPreview';

/* ─── Mock data ───────────────────────────────────────────────────── */

const MOCK_MAPPINGS: ZepMapping[] = [
  {
    universeId: 'univ_abc123def456',
    cohortLabel: 'Gig Workers (C1)',
    zepUserId: 'wf-cohort-c1-abc123',
    zepSessionId: 'wf-session-univ-abc123',
    status: 'synced',
    lastSync: '2 min ago',
  },
  {
    universeId: 'univ_abc123def456',
    cohortLabel: 'Platform Mgmt (C2)',
    zepUserId: 'wf-cohort-c2-abc123',
    zepSessionId: 'wf-session-univ-abc123',
    status: 'synced',
    lastSync: '2 min ago',
  },
  {
    universeId: 'univ_abc123def456',
    cohortLabel: 'Hero: Maria Chen',
    zepUserId: 'wf-hero-h1-abc123',
    zepSessionId: 'wf-session-hero-h1',
    status: 'pending',
    lastSync: '15 min ago',
  },
  {
    universeId: 'univ_xyz789ghi012',
    cohortLabel: 'Regulators (C3)',
    zepUserId: 'wf-cohort-c3-xyz789',
    zepSessionId: 'wf-session-univ-xyz789',
    status: 'error',
    lastSync: '1h ago',
  },
];

const DEFAULT_SETTINGS: ZepSettings = {
  cacheTtl: 300,
  defaultSummaryLevel: 'standard',
  healthcheckInterval: 30,
  maxSearchResults: 20,
  embedMode: true,
};

/* ─── Page ────────────────────────────────────────────────────────── */

export default function ZepPage() {
  const [url, setUrl] = useState('https://api.getzep.com');
  const [region, setRegion] = useState('us-east-1');
  const [memoryMode, setMemoryMode] = useState<MemoryMode>('perpetual');
  const [settings, setSettings] = useState<ZepSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('mappings');

  function handleSave() {
    toast.success('Zep settings saved', {
      description: 'Changes will take effect on the next tick cycle.',
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Zep Memory Integration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure Zep Cloud for cohort and hero memory persistence across simulation ticks.
          </p>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save and refresh
        </Button>
      </div>

      {/* Top cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ZepConnectionCard
          url={url}
          onUrlChange={setUrl}
          region={region}
          onRegionChange={setRegion}
        />
        <ZepMemoryMapCard mode={memoryMode} onModeChange={setMemoryMode} />
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
                  Each cohort and hero in a universe maps to a Zep user and session for persistent memory.
                </p>
                <MappingsTable
                  data={MOCK_MAPPINGS}
                  onResync={(id) => toast.info(`Re-sync queued for ${id.slice(0, 12)}…`)}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <IngestionStatusCard />
              <CycleWarmingCard />
            </div>
          </div>
        </TabsContent>

        {/* Threads tab */}
        <TabsContent value="threads" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            Thread detail view — select a mapping to inspect its Zep thread messages.
          </div>
        </TabsContent>

        {/* Graph tab */}
        <TabsContent value="graph" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ZepGraphPreview />
            <div className="space-y-4">
              <IngestionStatusCard queueDepth={5} lastSync="30s ago" successRate={99.1} />
              <ZepDocsCard />
            </div>
          </div>
        </TabsContent>

        {/* Search tab */}
        <TabsContent value="search" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            Semantic search across Zep knowledge graph — enter a query to retrieve relevant memories.
          </div>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-6">
          <div className="rounded-lg border bg-muted/20 p-8 text-center text-muted-foreground text-sm">
            Sync history log — timestamps, durations, and results for all Zep sync operations.
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
            <p className="font-medium">Zep memory is live during simulation</p>
            <p>
              When enabled, each cohort tick writes to Zep automatically. If Zep becomes
              unavailable, WorldFork falls back to local ledger summaries and queues a re-sync.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href="https://help.getzep.com/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-brand-900 dark:hover:text-brand-200"
              >
                Zep Docs
              </a>
              <a
                href="https://help.getzep.com/graph-overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-brand-900 dark:hover:text-brand-200"
              >
                Graph Overview
              </a>
              <a
                href="https://github.com/getzep/graphiti"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-brand-900 dark:hover:text-brand-200"
              >
                Graphiti
              </a>
            </div>
          </div>
        </div>

        {/* Docs card */}
        <ZepDocsCard />
      </div>
    </div>
  );
}
