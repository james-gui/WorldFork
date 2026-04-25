'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, RefreshCw, X, FileText, MessageSquare, Trash2 } from 'lucide-react';

interface JobActionMenuProps {
  jobId: string;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onViewArtifact?: (id: string) => void;
  onViewPrompt?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function JobActionMenu({
  jobId,
  onRetry,
  onCancel,
  onViewArtifact,
  onViewPrompt,
  onDelete,
}: JobActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onRetry?.(jobId)}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCancel?.(jobId)}>
          <X className="mr-2 h-3.5 w-3.5" />
          Cancel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onViewArtifact?.(jobId)}>
          <FileText className="mr-2 h-3.5 w-3.5" />
          View artifact
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onViewPrompt?.(jobId)}>
          <MessageSquare className="mr-2 h-3.5 w-3.5" />
          View prompt
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete?.(jobId)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
