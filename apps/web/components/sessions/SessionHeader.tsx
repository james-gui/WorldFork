'use client';

import * as React from 'react';
import Link from 'next/link';
import { Eye, Share2, MoreHorizontal, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusPill } from '@/components/chrome/StatusPill';
import { EditableTitle } from './EditableTitle';
import type { Run } from '@/lib/types/run';

interface SessionHeaderProps {
  run: Run;
  onRename?: (name: string) => void;
}

export function SessionHeader({ run, onRename }: SessionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      {/* Left: title + status */}
      <div className="flex items-center gap-3 flex-wrap">
        <EditableTitle value={run.display_name} onSave={onRename} />
        <StatusPill status={run.status} />
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button asChild variant="default" size="sm" className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5">
          <Link href={`/runs/${run.id}/universes/U000/review`}>
            <Eye className="h-4 w-4" />
            Open Review Mode
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="px-2">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Duplicate run</DropdownMenuItem>
            <DropdownMenuItem>Archive run</DropdownMenuItem>
            <DropdownMenuItem>Export run</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete run</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="h-4 w-4" />
          Open Files
        </Button>
      </div>
    </div>
  );
}
