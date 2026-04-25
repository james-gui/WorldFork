'use client';

import { ErrorBoundaryCard } from '@/components/chrome/ErrorBoundaryCard';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundaryCard
          error={error}
          reset={reset}
          title="Something went wrong"
          description="A critical error occurred. Please try refreshing the page."
        />
      </body>
    </html>
  );
}
