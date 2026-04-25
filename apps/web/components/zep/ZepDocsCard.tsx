'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, BookOpen } from 'lucide-react';

const DOCS = [
  { label: 'Zep Overview', href: 'https://help.getzep.com/overview' },
  { label: 'Memory API (v2)', href: 'https://help.getzep.com/v2/memory' },
  { label: 'Sessions API (v2)', href: 'https://help.getzep.com/v2/sessions' },
  { label: 'Threads', href: 'https://help.getzep.com/threads' },
  { label: 'Graph Overview', href: 'https://help.getzep.com/graph-overview' },
  { label: 'Graphiti (GitHub)', href: 'https://github.com/getzep/graphiti' },
];

export function ZepDocsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          Resources &amp; Documentation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {DOCS.map((doc) => (
            <li key={doc.href}>
              <a
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                {doc.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
