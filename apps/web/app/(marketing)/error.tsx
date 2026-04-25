'use client';

import { ErrorBoundaryCard } from '@/components/chrome/ErrorBoundaryCard';

export default function MarketingSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryCard
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An error occurred loading this page. Please try again."
    />
  );
}
