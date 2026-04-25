'use client';

import * as React from 'react';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}

interface FileTreeNodeProps {
  node: FileNode;
  depth?: number;
}

function FileTreeNode({ node, depth = 0 }: FileTreeNodeProps) {
  const [open, setOpen] = React.useState(depth < 2);

  const isDir = node.type === 'dir';

  return (
    <li>
      <button
        type="button"
        onClick={isDir ? () => setOpen((o) => !o) : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-0.5 rounded text-sm transition-colors hover:bg-muted/50',
          isDir ? 'cursor-pointer font-medium text-foreground' : 'cursor-default text-muted-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        aria-expanded={isDir ? open : undefined}
      >
        {isDir ? (
          open ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="h-3 w-3 flex-shrink-0" />
        )}
        {isDir ? (
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
        ) : (
          <File className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="text-xs font-mono truncate">{node.name}</span>
      </button>
      {isDir && open && node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <FileTreeNode key={`${child.name}-${i}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface FileTreeProps {
  nodes: FileNode[];
}

export function FileTree({ nodes }: FileTreeProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node, i) => (
        <FileTreeNode key={`${node.name}-${i}`} node={node} depth={0} />
      ))}
    </ul>
  );
}
