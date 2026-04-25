import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">WorldFork</span>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-bold text-muted-foreground/30">404</h1>
        <h2 className="text-xl font-bold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This timeline does not exist. It may have been frozen, killed, or never spawned.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/runs">Back to runs</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
