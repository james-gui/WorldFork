'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  History,
  Plus,
  Briefcase,
  ScrollText,
  Settings,
  Plug,
  Route,
  Shield,
  Database,
} from 'lucide-react';

const COMMANDS = [
  { group: 'Navigation', items: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: 'g d' },
    { label: 'Run History', href: '/runs', icon: History, shortcut: 'g r' },
    { label: 'New Big Bang', href: '/runs/new', icon: Plus, shortcut: 'g n' },
    { label: 'Jobs', href: '/jobs', icon: Briefcase, shortcut: 'g j' },
    { label: 'Logs', href: '/logs', icon: ScrollText, shortcut: 'g l' },
  ]},
  { group: 'Settings', items: [
    { label: 'Configuration', href: '/settings', icon: Settings, shortcut: 'g s' },
    { label: 'Integrations', href: '/settings/integrations', icon: Plug, shortcut: '' },
    { label: 'Model Routing', href: '/settings/routing', icon: Route, shortcut: '' },
    { label: 'Branch Policy', href: '/settings/branch-policy', icon: Shield, shortcut: '' },
    { label: 'Zep Memory', href: '/settings/zep', icon: Database, shortcut: '' },
  ]},
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const handleSelect = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search pages and actions..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {COMMANDS.map((group, gi) => (
              <React.Fragment key={group.group}>
                {gi > 0 && <CommandSeparator />}
                <CommandGroup heading={group.group}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <kbd className="ml-auto text-xs text-muted-foreground font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
