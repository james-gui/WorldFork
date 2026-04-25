'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STATUS_BADGE_CLS,
  triggerLabel,
  type MultiverseNodeData,
  type MultiverseTreePayload,
} from '@/lib/multiverse/types';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';

interface BranchHistoryTableProps {
  tree: MultiverseTreePayload;
}

export function BranchHistoryTable({ tree }: BranchHistoryTableProps) {
  const setSelectedUniverseId = useMultiverseUIStore(
    (s) => s.setSelectedUniverseId,
  );
  const selectedUniverseId = useMultiverseUIStore((s) => s.selectedUniverseId);

  const columns = React.useMemo<ColumnDef<MultiverseNodeData>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Universe ID',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelectedUniverseId(row.original.id)}
            className="font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.label}
          </button>
        ),
      },
      {
        accessorKey: 'parentId',
        header: 'Parent',
        cell: ({ row }) =>
          row.original.parentId ? (
            <button
              type="button"
              onClick={() => setSelectedUniverseId(row.original.parentId!)}
              className="font-mono text-xs hover:underline"
            >
              {row.original.parentId}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'depth',
        header: 'Depth',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">D{row.original.depth}</span>
        ),
      },
      {
        accessorKey: 'branch_tick',
        header: 'Branch Tick',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">T{row.original.branch_tick}</span>
        ),
      },
      {
        accessorKey: 'branch_trigger',
        header: 'Trigger',
        cell: ({ row }) => (
          <span className="text-xs">{triggerLabel(row.original.branch_trigger)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              'h-5 text-[10px] uppercase tracking-wide',
              STATUS_BADGE_CLS[row.original.status],
            )}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'divergence_score',
        header: 'Divergence',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.divergence_score.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'child_count',
        header: 'Children',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">{row.original.child_count}</span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {new Date(row.original.created_at).toLocaleString()}
          </span>
        ),
      },
    ],
    [setSelectedUniverseId],
  );

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);

  const table = useReactTable({
    data: tree.nodes,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Branch History</h3>
          <p className="text-xs text-muted-foreground">
            {tree.nodes.length} universes
          </p>
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-[11px]">
                    {header.isPlaceholder ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-7 px-2 text-[11px] font-semibold"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getCanSort() ? (
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        ) : null}
                      </Button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={
                  row.original.id === selectedUniverseId ? 'selected' : undefined
                }
                className={cn(
                  row.original.id === selectedUniverseId && 'bg-primary/5',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
