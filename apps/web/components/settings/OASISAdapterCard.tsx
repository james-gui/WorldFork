'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Globe } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';

const CONFIG_CHIPS = ['mini-shell-fallback', 'json-compat', 'strict-schema'];

export function OASISAdapterCard() {
  const form = useFormContext();

  return (
    <SettingsCard
      id="oasis-adapter"
      title="OASIS Adapter"
      description="Enable the OASIS social-platform simulator adapter."
      icon={<Globe className="h-4 w-4" />}
    >
      <FormField
        control={form.control}
        name="oasisEnabled"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Enable OASIS adapter</Label>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </div>
          </FormItem>
        )}
      />

      <p className="text-xs text-muted-foreground">
        Mini-shell fallback active when OASIS service is unreachable.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {CONFIG_CHIPS.map((chip) => (
          <Badge key={chip} variant="outline" className="text-xs font-mono">
            {chip}
          </Badge>
        ))}
      </div>
    </SettingsCard>
  );
}
