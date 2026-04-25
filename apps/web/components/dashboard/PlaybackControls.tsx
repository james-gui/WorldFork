'use client';

import * as React from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PlaybackControlsProps {
  autoplay: boolean;
  speed: number;
  onTogglePlay: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function PlaybackControls({
  autoplay,
  speed,
  onTogglePlay,
  onStep,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={autoplay ? 'default' : 'outline'}
        size="sm"
        onClick={onTogglePlay}
        className="gap-1.5"
      >
        {autoplay ? (
          <>
            <Pause className="h-3.5 w-3.5" /> Pause
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" /> Play
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onStep}
        disabled={autoplay}
        className="gap-1.5"
      >
        <SkipForward className="h-3.5 w-3.5" /> Step
      </Button>
      <Select
        value={String(speed)}
        onValueChange={(v) => onSpeedChange(parseFloat(v))}
      >
        <SelectTrigger className="h-9 w-[88px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEEDS.map((s) => (
            <SelectItem key={s} value={String(s)} className="text-xs">
              {s}× speed
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
