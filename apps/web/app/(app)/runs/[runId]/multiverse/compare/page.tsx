'use client';

import { CompareView } from '@/components/multiverse/CompareView';

export default function CompareBranchesPage({
  params,
  searchParams,
}: {
  params: { runId: string };
  searchParams?: { universes?: string };
}) {
  const initialUniverseIds = (searchParams?.universes ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return <CompareView runId={params.runId} initialUniverseIds={initialUniverseIds} />;
}
