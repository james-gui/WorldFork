'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings2 } from 'lucide-react';

export interface ZepSettings {
  cacheTtl: number;
  defaultSummaryLevel: string;
  healthcheckInterval: number;
  maxSearchResults: number;
  embedMode: boolean;
}

interface ZepSettingsCardProps {
  settings: ZepSettings;
  onChange: (s: ZepSettings) => void;
}

export function ZepSettingsCard({ settings, onChange }: ZepSettingsCardProps) {
  const set = <K extends keyof ZepSettings>(key: K, val: ZepSettings[K]) =>
    onChange({ ...settings, [key]: val });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Cache TTL (seconds)</Label>
          <Input
            type="number"
            value={settings.cacheTtl}
            onChange={(e) => set('cacheTtl', Number(e.target.value))}
            className="h-8 text-sm"
            min={0}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Default summary level</Label>
          <Select
            value={settings.defaultSummaryLevel}
            onValueChange={(v) => set('defaultSummaryLevel', v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concise">Concise</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Healthcheck interval (seconds)</Label>
          <Input
            type="number"
            value={settings.healthcheckInterval}
            onChange={(e) => set('healthcheckInterval', Number(e.target.value))}
            className="h-8 text-sm"
            min={5}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Max search results</Label>
          <Input
            type="number"
            value={settings.maxSearchResults}
            onChange={(e) => set('maxSearchResults', Number(e.target.value))}
            className="h-8 text-sm"
            min={1}
            max={100}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Embed mode</Label>
          <Switch
            checked={settings.embedMode}
            onCheckedChange={(v) => set('embedMode', v)}
            className="scale-75"
          />
        </div>
      </CardContent>
    </Card>
  );
}
