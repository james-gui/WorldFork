'use client';

import * as React from 'react';
import { MoreHorizontal, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderLogo, ProviderId } from './ProviderLogo';
import { ProviderStatusPill, ProviderStatus } from './ProviderStatusPill';

interface ProviderCardProps {
  id: ProviderId;
  name: string;
  status: ProviderStatus;
  defaultModel?: string;
  baseUrl?: string;
  models?: string[];
  onTest?: () => Promise<void>;
  onChange?: (value: { defaultModel: string; baseUrl: string }) => void;
}

export function ProviderCard({
  id,
  name,
  status,
  defaultModel,
  baseUrl,
  models = [],
  onTest,
  onChange,
}: ProviderCardProps) {
  const [testing, setTesting] = React.useState(false);
  const [localModel, setLocalModel] = React.useState(defaultModel ?? '');
  const [localUrl, setLocalUrl] = React.useState(baseUrl ?? '');

  React.useEffect(() => {
    setLocalModel(defaultModel ?? '');
    setLocalUrl(baseUrl ?? '');
  }, [defaultModel, baseUrl]);

  const updateModel = (value: string) => {
    setLocalModel(value);
    onChange?.({ defaultModel: value, baseUrl: localUrl });
  };

  const updateBaseUrl = (value: string) => {
    setLocalUrl(value);
    onChange?.({ defaultModel: localModel, baseUrl: value });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      if (onTest) {
        await onTest();
      }
      toast.success(`${name}: connection test passed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${name}: connection test failed.`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <ProviderLogo provider={id} className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ProviderStatusPill status={testing ? 'testing' : status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit credentials</DropdownMenuItem>
                <DropdownMenuItem>View usage</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Disconnect</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 flex-1">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Default Model</Label>
          {models.length > 0 ? (
            <Select value={localModel} onValueChange={updateModel}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={localModel}
              onChange={(e) => updateModel(e.target.value)}
              placeholder="model name"
              className="h-7 text-xs font-mono"
            />
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Base URL</Label>
          <Input
            value={localUrl}
            onChange={(e) => updateBaseUrl(e.target.value)}
            placeholder="https://..."
            className="h-7 text-xs font-mono"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 w-full mt-2"
          onClick={testConnection}
          disabled={testing}
        >
          <FlaskConical className="h-3 w-3" />
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
      </CardContent>
    </Card>
  );
}
