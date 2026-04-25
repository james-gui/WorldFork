import * as React from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Run } from '@/lib/types/run';

interface SessionInputsTabProps {
  run: Run;
}

export function SessionInputsTab({ run }: SessionInputsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Original Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {run.scenario_text}
              </p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">No additional docs uploaded for this run.</p>
        </CardContent>
      </Card>
    </div>
  );
}
