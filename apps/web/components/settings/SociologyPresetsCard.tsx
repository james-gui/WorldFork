'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Users } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { SliderRow } from './SliderRow';
import { Button } from '@/components/ui/button';

export function SociologyPresetsCard() {
  const form = useFormContext();
  const beliefDrift = useWatch({ control: form.control, name: 'beliefDriftEta' });
  const mobilization = useWatch({ control: form.control, name: 'mobilizationThreshold' });
  const spiralIsolation = useWatch({ control: form.control, name: 'spiralSilenceIsolation' });

  const resetDefaults = () => {
    form.setValue('beliefDriftEta', 0.15, { shouldDirty: true });
    form.setValue('mobilizationThreshold', 0.6, { shouldDirty: true });
    form.setValue('spiralSilenceIsolation', 0.3, { shouldDirty: true });
  };

  return (
    <SettingsCard
      id="sociology-presets"
      title="Sociology Presets"
      description="Calibrate the core sociology engine parameters."
      icon={<Users className="h-4 w-4" />}
    >
      <SliderRow
        label="Belief drift η"
        value={beliefDrift ?? 0.15}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => form.setValue('beliefDriftEta', v, { shouldDirty: true })}
      />

      <SliderRow
        label="Mobilization threshold"
        value={mobilization ?? 0.6}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => form.setValue('mobilizationThreshold', v, { shouldDirty: true })}
      />

      <SliderRow
        label="Spiral-of-silence isolation threshold"
        value={spiralIsolation ?? 0.3}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => form.setValue('spiralSilenceIsolation', v, { shouldDirty: true })}
      />

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" className="h-8 text-xs flex-1">
          Save preset
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs flex-1"
          onClick={resetDefaults}
        >
          Reset to defaults
        </Button>
      </div>
    </SettingsCard>
  );
}
