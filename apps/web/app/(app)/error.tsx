'use client';

import { ErrorBoundaryCard } from '@/components/chrome/ErrorBoundaryCard';

export default function AppSegmentError({
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
      description="An error occurred in the application. Try again or return to the home page."
    />
  );
}
