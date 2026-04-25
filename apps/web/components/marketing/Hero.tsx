'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, BarChart2, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewCard } from './PreviewCard';

const BADGES = [
  { icon: ShieldCheck, label: 'All passwords applied' },
  { icon: BarChart2, label: 'Real-time analytics' },
  { icon: Sliders, label: 'Customizable by design' },
];

export function Hero() {
  return (
    <section className="container pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: text + CTAs */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 mb-6 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            Now in early access
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-[52px] font-bold tracking-tight text-foreground leading-[1.1]">
            Explore the multiverse of{' '}
            <span className="text-brand-600 dark:text-brand-400">
              social outcomes.
            </span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            WorldFork lets you analyze diverging realities, model dynamic social
            behavior, and uncover insights across infinite possibilities.
          </p>

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Button asChild size="lg" className="bg-brand-600 hover:bg-brand-700 text-white shadow-sm">
              <Link href="/runs/new" className="flex items-center gap-2">
                Start a New Simulation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/product">View live demo</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
            {BADGES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Icon className="h-4 w-4 text-brand-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: preview card */}
        <div className="flex justify-center lg:justify-end">
          <PreviewCard />
        </div>
      </div>
    </section>
  );
}
