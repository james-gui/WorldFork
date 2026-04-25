'use client';

import * as React from 'react';
import { Plug, Cloud, Bot, Server, Brain } from 'lucide-react';

export type ProviderId = 'openrouter' | 'openai' | 'anthropic' | 'ollama' | 'zep';

interface ProviderLogoProps {
  provider: ProviderId;
  className?: string;
}

const ICON_MAP: Record<ProviderId, React.ComponentType<{ className?: string }>> = {
  openrouter: Plug,
  openai: Cloud,
  anthropic: Bot,
  ollama: Server,
  zep: Brain,
};

export function ProviderLogo({ provider, className }: ProviderLogoProps) {
  const Icon = ICON_MAP[provider] ?? Plug;
  return <Icon className={className} />;
}
