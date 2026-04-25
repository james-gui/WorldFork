'use client';

import * as React from 'react';
import { MiniSparkline } from './MiniSparkline';
import { MiniNetwork } from './MiniNetwork';
import { GitBranch, Share2 } from 'lucide-react';

// Static placeholder data for sparklines
const ANXIETY_DATA = [
  { v: 3.2 }, { v: 3.5 }, { v: 4.1 }, { v: 3.8 }, { v: 5.2 },
  { v: 5.8 }, { v: 6.2 }, { v: 5.9 }, { v: 6.7 }, { v: 7.1 },
  { v: 6.8 }, { v: 7.4 },
];

const TRUST_DATA = [
  { v: 7.1 }, { v: 6.8 }, { v: 6.5 }, { v: 6.2 }, { v: 5.8 },
  { v: 5.3 }, { v: 4.9 }, { v: 4.6 }, { v: 4.2 }, { v: 3.9 },
  { v: 3.6 }, { v: 3.3 },
];

const HOPE_DATA = [
  { v: 4.0 }, { v: 4.3 }, { v: 5.1 }, { v: 4.8 }, { v: 5.5 },
  { v: 6.0 }, { v: 5.7 }, { v: 6.3 }, { v: 6.8 }, { v: 6.5 },
  { v: 7.0 }, { v: 7.5 },
];

export function PreviewCard() {
  return (
    <div className="relative rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden w-full max-w-[480px]">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-semibold text-foreground">Global Policy Debate</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
            Active
          </span>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Share"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sparklines row */}
      <div className="grid grid-cols-3 gap-3 px-4 py-3 border-b border-border/40 bg-background/50">
        <MiniSparkline data={ANXIETY_DATA} color="#f43f5e" label="Anxiety" />
        <MiniSparkline data={TRUST_DATA} color="#0ea5e9" label="Trust" />
        <MiniSparkline data={HOPE_DATA} color="#10b981" label="Hope" />
      </div>

      {/* Network graph */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Exposure Network</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              Archetype
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-300" />
              Hero
            </span>
          </div>
        </div>
        <div className="h-[160px]">
          <MiniNetwork />
        </div>
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 bg-muted/20">
        {[
          { label: 'Universes', value: '4' },
          { label: 'Tick', value: '12 / 24' },
          { label: 'Branches', value: '3' },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-2 text-center">
            <div className="text-sm font-semibold text-foreground">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
