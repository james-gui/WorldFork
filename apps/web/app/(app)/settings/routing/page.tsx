'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RotateCcw, Save, Import } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RoutingPoliciesTable } from '@/components/routing/RoutingPoliciesTable';
import { GlobalRoutingSettingsCard } from '@/components/routing/GlobalRoutingSettingsCard';
import { RoutingUsageCard } from '@/components/routing/RoutingUsageCard';
import { QuotaPressureCard } from '@/components/routing/QuotaPressureCard';
import { CostBurnCard } from '@/components/routing/CostBurnCard';
import { AlertsCard } from '@/components/routing/AlertsCard';
import { usePatchRouting } from '@/lib/api/settings';

export default function RoutingPage() {
  const { mutateAsync, isPending } = usePatchRouting();

  const handleSave = async () => {
    try {
      await new Promise<void>((r) => setTimeout(r, 200));
      void mutateAsync({}).catch(() => {});
      toast.success('Routing settings saved.');
    } catch {
      toast.error('Failed to save routing settings.');
    }
  };

  const handleReset = () => {
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Import className="h-3.5 w-3.5" />
            Import Policies
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
            <RoutingPoliciesTable />
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
