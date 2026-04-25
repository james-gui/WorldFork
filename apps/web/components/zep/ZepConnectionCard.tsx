'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Loader2, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useTestZep } from '@/lib/api/integrations';

interface ZepConnectionCardProps {
  url?: string;
  onUrlChange?: (v: string) => void;
  region?: string;
  onRegionChange?: (v: string) => void;
  disabledMode?: boolean;
}

export function ZepConnectionCard({
  url = 'https://api.getzep.com',
  onUrlChange,
  region = 'us-east-1',
  onRegionChange,
  disabledMode = false,
}: ZepConnectionCardProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const testZep = useTestZep();

  async function handleTest() {
    if (disabledMode) {
      setTestStatus('ok');
      return;
    }
    setTestStatus('testing');
    try {
      const result = await testZep.mutateAsync();
      if (!result.ok) {
        throw new Error(result.error ?? 'Zep healthcheck failed');
      }
      setTestStatus('ok');
    } catch {
      setTestStatus('error');
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Zep URL</Label>
          <Input
            value={url}
            onChange={(e) => onUrlChange?.(e.target.value)}
            className="h-8 text-sm font-mono"
            disabled={disabledMode}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">API Key (env var)</Label>
          <Input
            value="ZEP_API_KEY"
            readOnly
            className="h-8 text-sm font-mono text-muted-foreground bg-muted"
          />
          <p className="text-[10px] text-muted-foreground">Set in server environment — never committed to source.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Select value={region} onValueChange={onRegionChange}>
            <SelectTrigger className="h-8 text-sm" disabled={disabledMode}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us-east-1">US East 1</SelectItem>
              <SelectItem value="us-west-2">US West 2</SelectItem>
              <SelectItem value="eu-central-1">EU Central 1</SelectItem>
              <SelectItem value="ap-southeast-1">AP Southeast 1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={disabledMode || testStatus === 'testing'}>
            {testStatus === 'testing' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {disabledMode ? 'Local mode active' : 'Test connection'}
          </Button>

          {disabledMode ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" />
              Zep disabled
            </div>
          ) : testStatus === 'ok' && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <XCircle className="h-3.5 w-3.5" />
              Failed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
