'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Override map for URL segments → human-friendly breadcrumb labels.
 * Keys are exact lowercase segment strings.
 */
const BREADCRUMB_OVERRIDES: Record<string, string> = {
  runs: 'Run History',
  new: 'New Big Bang',
  dashboard: 'Dashboard',
  network: 'Network Graph',
  multiverse: 'Multiverse Explorer',
  'multiverse-legacy': 'Legacy Multiverse',
  review: 'Review Mode',
  settings: 'Settings',
  integrations: 'Integrations',
  routing: 'Model Routing',
  'branch-policy': 'Branch Policy',
  zep: 'Zep Memory',
  jobs: 'Jobs',
  logs: 'Logs',
  universes: '', // skip — followed by [uid]
};

/**
 * Segments that are dynamic IDs (typically preceded by known parent).
 * We show a truncated version with an href so users can click back.
 */
const ID_PARENTS = new Set(['runs', 'universes']);

function humanizeSegment(seg: string): string {
  if (BREADCRUMB_OVERRIDES[seg] !== undefined) {
    return BREADCRUMB_OVERRIDES[seg];
  }
  // Unknown segment — try to humanize kebab-case
  return seg
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function deriveCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];

  let path = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += `/${seg}`;
    const prevSeg = segments[i - 1];

    // Skip "universes" — it only makes sense as context before the uid
    if (seg === 'universes') {
      continue;
    }

    // Dynamic ID segments
    if (prevSeg && ID_PARENTS.has(prevSeg)) {
      // Show truncated ID with link
      const label = seg.length > 12 ? `${seg.slice(0, 8)}…` : seg;
      crumbs.push({ label, href: path });
      continue;
    }

    const label = humanizeSegment(seg);
    if (!label) continue; // skip empty overrides

    // Last segment has no href (current page)
    const isLast = i === segments.length - 1;

    // Navigable segments
    const navigable = ['runs', 'settings', 'jobs', 'logs', 'dashboard'].includes(seg);
    crumbs.push({ label, href: isLast ? undefined : navigable ? path : undefined });
  }

  return crumbs;
}

interface BreadcrumbsProps {
  className?: string;
}

export function Breadcrumbs({ className }: BreadcrumbsProps) {
  const pathname = usePathname();
  const crumbs = deriveCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              />
            )}
            {i === 0 ? (
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label="Home"
              >
                <Home className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : isLast || !crumb.href ? (
              <span
                className={cn(
                  'font-medium truncate max-w-[160px]',
                  isLast ? 'text-foreground' : 'text-muted-foreground'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
