'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Database, Globe, BookOpen, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { WizardFormValues } from './BigBangWizard';

interface SourceOption {
  id: keyof WizardFormValues['sources'];
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: 'useWeb',
    label: 'Web search',
    description: 'Real-time web context injected into initializer prompt',
    icon: <Globe className="h-4 w-4" />,
    badge: 'Requires key',
  },
  {
    id: 'useZep',
    label: 'Zep memory',
    description: 'Ingest prior run summaries and archetype history from Zep',
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: 'useSotSnapshot',
    label: 'SoT snapshot',
    description: 'Bind the current source-of-truth taxonomy version to this run',
    icon: <BookOpen className="h-4 w-4" />,
    badge: 'Recommended',
  },
  {
    id: 'useUploadedDocs',
    label: 'Uploaded documents',
    description: 'Include reference PDFs, CSVs, and MD files from Step 1',
    icon: <FileText className="h-4 w-4" />,
  },
];

export function Step2Sources() {
  const { watch, setValue } = useFormContext<WizardFormValues>();
  const sources = watch('sources');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Data sources</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose which data sources the initializer should use when generating your scenario.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {SOURCE_OPTIONS.map((opt) => {
          const enabled = sources?.[opt.id] ?? false;
          return (
            <div
              key={opt.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {opt.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`source-${opt.id}`} className="text-sm font-medium cursor-pointer">
                      {opt.label}
                    </Label>
                    {opt.badge && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {opt.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </div>
              <Switch
                id={`source-${opt.id}`}
                checked={enabled}
                onCheckedChange={(v) =>
                  setValue('sources', { ...sources, [opt.id]: v })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
