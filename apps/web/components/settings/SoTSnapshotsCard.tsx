'use client';

import { useFormContext } from 'react-hook-form';
import { Database } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';

export function SoTSnapshotsCard() {
  const form = useFormContext();

  return (
    <SettingsCard
      id="sot-snapshots"
      title="Source-of-Truth Snapshots"
      description="Manage versioned SoT bundles used during runs."
      icon={<Database className="h-4 w-4" />}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Current version:</span>
        <Badge variant="secondary" className="font-mono text-xs">v1.0.0</Badge>
      </div>

      <FormField
        control={form.control}
        name="sotApplyPerRun"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Apply per run</Label>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </div>
          </FormItem>
        )}
      />
    </SettingsCard>
  );
}
