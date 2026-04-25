'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  Plus,
  Network,
  GitBranch,
  BookOpen,
  Settings,
  Plug,
  Route,
  Shield,
  Database,
  Briefcase,
  ScrollText,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelpDocsCard } from './HelpDocsCard';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Simulations',
    items: [
      { label: 'Run History', href: '/runs', icon: History },
      { label: 'New Big Bang', href: '/runs/new', icon: Plus },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { label: 'Network Graph', href: '/network', icon: Network },
      { label: 'Multiverse', href: '/multiverse', icon: GitBranch },
      { label: 'Review Mode', href: '/review', icon: BookOpen },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Configuration', href: '/settings', icon: Settings },
      { label: 'Integrations', href: '/settings/integrations', icon: Plug },
      { label: 'Model Routing', href: '/settings/routing', icon: Route },
      { label: 'Branch Policy', href: '/settings/branch-policy', icon: Shield },
      { label: 'Zep Memory', href: '/settings/zep', icon: Database },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Jobs', href: '/jobs', icon: Briefcase },
      { label: 'Logs', href: '/logs', icon: ScrollText },
    ],
  },
];

interface AppSidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-medium'
          : 'text-muted-foreground',
        collapsed && 'justify-center px-2'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function AppSidebarContent({
  collapsed,
  onNavigate,
}: AppSidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div
        className={cn(
          'flex items-center gap-2 p-4 border-b border-border',
          collapsed && 'justify-center'
        )}
      >
        <Layers className="h-6 w-6 text-brand-600 flex-shrink-0" aria-hidden="true" />
        {!collapsed && (
          <span className="font-semibold text-base tracking-tight">WorldFork</span>
        )}
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="space-y-0.5">
            {section.title && !collapsed && (
              <p className="px-2.5 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Help card */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <HelpDocsCard />
        </div>
      )}
    </div>
  );
}
