import * as React from 'react';
import Link from 'next/link';
import { BookOpen, LifeBuoy, MessageCircle } from 'lucide-react';

export function HelpDocsCard() {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
      <p className="font-medium text-foreground mb-2">Need help?</p>
      <div className="space-y-1.5">
        <Link
          href="/docs"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
          Documentation
        </Link>
        <a
          href="https://github.com/worldfork/worldfork/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LifeBuoy className="h-3.5 w-3.5 flex-shrink-0" />
          Report an issue
        </a>
        <a
          href="mailto:support@worldfork.ai"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Contact support
        </a>
      </div>
    </div>
  );
}
