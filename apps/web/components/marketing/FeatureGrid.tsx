import * as React from 'react';
import {
  GitBranch,
  Network,
  PlayCircle,
  History,
  Settings2,
  FileText,
} from 'lucide-react';
import { FeatureCard } from './FeatureCard';

const FEATURES = [
  {
    icon: GitBranch,
    iconColor: 'text-brand-600',
    iconBg: 'bg-brand-100 dark:bg-brand-900/30',
    title: 'Multiverse Simulation',
    description:
      'Create recursive branches from any timeline and explore alternate social futures with diverging actor dynamics.',
    href: '/product',
    linkLabel: 'Explore simulations',
  },
  {
    icon: Network,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    title: 'Network Graph View',
    description:
      'Visualize multiplex influence networks across exposure, trust, dependency, mobilization, and identity layers.',
    href: '/product',
    linkLabel: 'Open graph view',
  },
  {
    icon: PlayCircle,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    title: 'Review Mode',
    description:
      'Step through every tick, cohort decision, and God-agent action with full prompt and reasoning visibility.',
    href: '/product',
    linkLabel: 'Open graph goal',
  },
  {
    icon: History,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    title: 'Run History',
    description:
      'Browse, rename, favorite, archive, or duplicate past simulations — complete with filterable metadata.',
    href: '/runs',
    linkLabel: 'View run history',
  },
  {
    icon: Settings2,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    title: 'Settings',
    description:
      'Configure model providers, branch policies, rate limits, memory adapters, and source-of-truth taxonomies.',
    href: '/settings',
    linkLabel: 'Open settings',
  },
  {
    icon: FileText,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    title: 'Explainable Logs',
    description:
      'Every LLM call, tool invocation, and state mutation is persisted and queryable through the log explorer.',
    href: '/logs',
    linkLabel: 'View logs',
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="container pb-24 pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((feat) => (
          <FeatureCard key={feat.title} {...feat} />
        ))}
      </div>
    </section>
  );
}
