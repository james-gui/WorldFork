'use client';

import * as React from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReviewPlaybackControlsProps {
  paused: boolean;
  onTogglePaused: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
}

const SPEEDS = [0.5, 1, 1.5, 2, 4];

export function ReviewPlaybackControls({
  paused,
  onTogglePaused,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd,
  speed,
  onSpeedChange,
}: ReviewPlaybackControlsProps) {
  return (
    <div className="border-t border-border bg-card px-6 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onJumpStart}
          aria-label="Jump to start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onStepBack}
          aria-label="Step back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="h-9 w-9"
          onClick={onTogglePaused}
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onStepForward}
          aria-label="Step forward"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onJumpEnd}
          aria-label="Jump to end"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed</span>
        <Select
          value={String(speed)}
          onValueChange={(v) => onSpeedChange(parseFloat(v))}
        >
          <SelectTrigger className="h-8 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEEDS.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
