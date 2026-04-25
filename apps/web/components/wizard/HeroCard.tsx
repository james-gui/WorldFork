'use client';

import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface HeroCardData {
  id: string;
  name: string;
  role: string;
  initials?: string;
  avatarColor?: string;
}

interface HeroCardProps {
  hero: HeroCardData;
  className?: string;
}

export function HeroCard({ hero, className }: HeroCardProps) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5', className)}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold',
            hero.avatarColor ?? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
          )}
        >
          {hero.initials ?? hero.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">{hero.name}</span>
        <span className="text-[10px] text-muted-foreground truncate">{hero.role}</span>
      </div>
    </div>
  );
}
