'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export interface ZepMapping {
  universeId: string;
  cohortLabel: string;
  zepUserId: string;
  zepSessionId: string;
  status: 'synced' | 'pending' | 'error';
  lastSync: string;
}

interface MappingsTableProps {
  data: ZepMapping[];
  onResync?: (universeId: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  synced: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

export function MappingsTable({ data, onResync }: MappingsTableProps) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Universe ID</TableHead>
            <TableHead className="text-xs">Cohort / Hero</TableHead>
            <TableHead className="text-xs">Zep User ID</TableHead>
            <TableHead className="text-xs">Zep Session ID</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Last sync</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-10">
                No mappings configured yet
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={`${row.universeId}-${row.cohortLabel}`}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.universeId.slice(0, 12)}…
                </TableCell>
                <TableCell className="text-xs font-medium">{row.cohortLabel}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.zepUserId}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.zepSessionId}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLE[row.status]}`}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.lastSync}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onResync?.(row.universeId)}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Re-sync
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
