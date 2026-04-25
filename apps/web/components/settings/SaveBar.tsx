'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SaveBarProps {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isLoading?: boolean;
}

export function SaveBar({ visible, onSave, onDiscard, isLoading }: SaveBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur px-6 py-3 flex items-center justify-between transition-transform duration-200',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={isLoading}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
