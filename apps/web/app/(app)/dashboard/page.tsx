import * as React from 'react';
import Link from 'next/link';
import { Plus, History } from 'lucide-react';

// Placeholder dashboard — B9-A will build the full simulation dashboard.
export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <div className="max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-6">
          <History className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Pick a simulation
        </h1>
        <p className="mt-2 text-muted-foreground">
          Select an existing run from history or launch a new Big Bang to get started.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center">
          <Link
            href="/runs"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <History className="h-4 w-4" />
            View Run History
          </Link>
          <Link
            href="/runs/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Big Bang
          </Link>
        </div>
      </div>
    </div>
  );
}
