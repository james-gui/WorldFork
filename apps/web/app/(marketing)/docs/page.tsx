import * as React from 'react';
import { DocsCard } from '@/components/docs/DocsCard';
import { Rocket, Code2, Brain, Heart, Users, Lightbulb } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Page — /docs
// Documentation overview for local development and API orientation.
export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">WorldFork Documentation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Everything you need to simulate, fork, and analyse recursive social timelines.
          Choose a section to get started.
        </p>
      </div>

      {/* 3-column card grid */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6">Getting started</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DocsCard
            title="Quickstart"
            description="Create your first Big Bang run, watch universes branch, and review a timeline in under 10 minutes."
            href="/docs/quickstart"
            icon={<Rocket className="h-5 w-5" />}
          />
          <DocsCard
            title="API Reference"
            description="Full REST API surface for runs, universes, ticks, artifacts, and the multiverse tree."
            href="/docs/api"
            icon={<Code2 className="h-5 w-5" />}
          />
          <DocsCard
            title="Core Concepts"
            description="Understand Big Bangs, universes, branching policies, God-Agent decisions, and the sociology engine."
            href="/docs/concepts"
            icon={<Brain className="h-5 w-5" />}
          />
        </div>
      </section>

      <Separator className="mb-16" />

      {/* Source-of-truth schema reference */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Source-of-truth schema reference</h2>
        <p className="text-sm text-muted-foreground mb-8">
          The WorldFork sociology engine is grounded in a versioned source-of-truth (SoT) that
          defines the axes along which agents can differ. Current version:{' '}
          <span className="font-mono">1.0.0</span>.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DocsCard
            title="Emotions"
            description="12 discrete emotion categories: Anger, Fear, Hope, Pride, Disgust, Solidarity, Anxiety, Indifference, Enthusiasm, Grief, Shame, Contempt."
            href="/docs/sources#emotions"
            icon={<Heart className="h-5 w-5" />}
          />
          <DocsCard
            title="Behaviors"
            description="Continuous axes for Aggression, Cooperation, Conformity, Activism, and Mobilization (all 0–1 normalised)."
            href="/docs/sources#behaviors"
            icon={<Users className="h-5 w-5" />}
          />
          <DocsCard
            title="Ideologies"
            description="Five bi-polar ideology axes: Economic, Social, Authority, Nationalism, and Environment — each defined by opposing poles."
            href="/docs/sources#ideologies"
            icon={<Lightbulb className="h-5 w-5" />}
          />
        </div>

        {/* Inline inline expansion */}
        <div className="mt-8 rounded-lg border bg-muted/30 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Inline reference
          </h3>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 text-sm">
            <div>
              <p className="font-medium mb-2">Emotions</p>
              <ul className="space-y-1 text-muted-foreground">
                {EMOTIONS.map((e) => (
                  <li key={e} className="font-mono text-xs">{e}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">Behavior axes</p>
              <ul className="space-y-1 text-muted-foreground">
                {BEHAVIORS.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{b.id}</span>
                    <span className="text-xs text-muted-foreground/70">{b.range}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium mb-2">Ideology axes</p>
              <ul className="space-y-2 text-muted-foreground">
                {IDEOLOGIES.map((ideo) => (
                  <li key={ideo.id}>
                    <p className="font-mono text-xs">{ideo.id}</p>
                    <p className="text-xs text-muted-foreground/70">
                      {ideo.left} ↔ {ideo.right}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Static reference data ─────────────────────────────────────────────────────

const EMOTIONS = [
  'anger', 'fear', 'hope', 'pride', 'disgust', 'solidarity',
  'anxiety', 'indifference', 'enthusiasm', 'grief', 'shame', 'contempt',
];

const BEHAVIORS = [
  { id: 'aggression', range: '0–1' },
  { id: 'cooperation', range: '0–1' },
  { id: 'conformity', range: '0–1' },
  { id: 'activism', range: '0–1' },
  { id: 'mobilization', range: '0–1' },
];

const IDEOLOGIES = [
  { id: 'economic', left: 'Left', right: 'Right' },
  { id: 'social', left: 'Progressive', right: 'Conservative' },
  { id: 'authority', left: 'Libertarian', right: 'Authoritarian' },
  { id: 'nationalism', left: 'Globalist', right: 'Nationalist' },
  { id: 'environment', left: 'Eco-priority', right: 'Growth-priority' },
];
