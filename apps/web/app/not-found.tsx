import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-background text-foreground">
      <div className="flex items-center gap-2">
        <Layers className="h-7 w-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">WorldFork</span>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
        <h2 className="text-2xl font-bold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          The timeline you are looking for does not exist in this universe.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/runs">View runs</Link>
        </Button>
      </div>
    </div>
  );
}
