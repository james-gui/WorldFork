'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { MultiverseTreePayload } from '@/lib/multiverse/types';

// React Flow + dagre are browser-only — load via dynamic import w/ ssr: false.
const MultiverseTreeImpl = dynamic(() => import('./MultiverseTreeImpl'), {
  ssr: false,
  loading: () => (
    <div className="size-full grid place-items-center p-4">
      <Skeleton className="size-full rounded-lg" />
    </div>
  ),
});

export interface MultiverseTreeProps {
  tree: MultiverseTreePayload;
  bbId?: string;
}

export function MultiverseTree({ tree, bbId }: MultiverseTreeProps) {
  return <MultiverseTreeImpl tree={tree} bbId={bbId} />;
}
