'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

interface KVPair {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  label?: string;
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}

export function KeyValueEditor({
  label,
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add row',
}: KeyValueEditorProps) {
  const updatePair = (idx: number, field: 'key' | 'value', val: string) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };

  const removePair = (idx: number) => {
    onChange(pairs.filter((_, i) => i !== idx));
  };

  const addPair = () => {
    onChange([...pairs, { key: '', value: '' }]);
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={(e) => updatePair(i, 'key', e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Input
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={(e) => updatePair(i, 'value', e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => removePair(i)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addPair}
      >
        <Plus className="h-3 w-3" />
        {addLabel}
      </Button>
    </div>
  );
}
