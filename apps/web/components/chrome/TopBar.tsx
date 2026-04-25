'use client';

import * as React from 'react';
import { Search, Bell, User, Command, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Breadcrumbs } from './Breadcrumbs';
import { StatusPill } from './StatusPill';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '@/lib/state/uiStore';
import { useGlobalKeyboard } from '@/lib/keyboard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AppSidebarContent } from './AppSidebarContent';

export function TopBar() {
  const currentRunId = useUIStore((s) => s.currentRunId);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Mount global keyboard shortcuts here (in the TopBar which is always visible)
  useGlobalKeyboard(() => setCommandOpen(true));

  // Also listen for the custom event from keyboard.ts
  React.useEffect(() => {
    const handler = () => setCommandOpen(true);
    document.addEventListener('worldfork:open-command-palette', handler);
    return () => document.removeEventListener('worldfork:open-command-palette', handler);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return (
    <>
      <header className="flex items-center gap-2 h-14 px-4 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        {/* Hamburger — visible on mobile only */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0">
          <Breadcrumbs />
        </div>

        {/* Status pill for active run */}
        {currentRunId && (
          <StatusPill status="running" className="flex-shrink-0" />
        )}

        {/* Search / command palette trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Open command palette (Cmd+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User avatar */}
        <button
          className="flex items-center justify-center h-8 w-8 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-sm font-medium hover:ring-2 hover:ring-brand-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="User menu"
        >
          <User className="h-4 w-4" />
        </button>
      </header>

      {/* Command palette dialog */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Mobile navigation sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <AppSidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
