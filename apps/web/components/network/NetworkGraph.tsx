'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { NetworkDataset } from '@/lib/network/seededDataset';

// Sigma + graphology are browser-only — load via dynamic import w/ ssr: false.
const NetworkGraphImpl = dynamic(() => import('./NetworkGraphImpl'), {
  ssr: false,
  loading: () => (
    <div className="size-full grid place-items-center">
      <Skeleton className="size-full rounded-lg" />
    </div>
  ),
});

export interface NetworkGraphProps {
  data: NetworkDataset;
}

export function NetworkGraph({ data }: NetworkGraphProps) {
  return <NetworkGraphImpl data={data} />;
}
