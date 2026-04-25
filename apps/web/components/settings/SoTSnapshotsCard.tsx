'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Database, Upload } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';

export function SoTSnapshotsCard() {
  const form = useFormContext();
  const fileRef = React.useRef<HTMLInputElement>(null);

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

      <div>
        <Input
          ref={fileRef}
          type="file"
          accept=".json,.zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // stub — handle file upload
              console.info('SoT file selected:', file.name);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1 w-full"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Choose SoT file
        </Button>
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

      <Button type="button" size="sm" className="h-8 text-xs w-full">
        Snapshot now
      </Button>
    </SettingsCard>
  );
}
