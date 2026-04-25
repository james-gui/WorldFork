'use client';

import * as React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Trash2, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BranchPolicyFormValues } from './schema';

const METRICS = ['mobilization', 'polarization', 'trust', 'volatility'];
const OPERATORS = ['>', '<', '>=', '<=', '=='];
const ACTIONS = ['spawn_candidate', 'spawn_active', 'freeze', 'kill', 'mark_event'];

export function ConditionsTable() {
  const form = useFormContext<BranchPolicyFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'conditions',
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">API Threats Conditions</p>
          <p className="text-[10px] text-muted-foreground">
            Trigger-based actions evaluated each tick
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() =>
            append({
              id: `cond_${Date.now()}`,
              trigger: 'New Trigger',
              metric: 'mobilization',
              operator: '>',
              threshold: 0.5,
              action: 'spawn_candidate',
            })
          }
        >
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] uppercase">Trigger</TableHead>
            <TableHead className="text-[10px] uppercase">Metric</TableHead>
            <TableHead className="text-[10px] uppercase w-20">Op</TableHead>
            <TableHead className="text-[10px] uppercase w-24">Threshold</TableHead>
            <TableHead className="text-[10px] uppercase">Action</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, idx) => (
            <TableRow key={field.id}>
              <TableCell className="py-1.5">
                <Input
                  {...form.register(`conditions.${idx}.trigger`)}
                  className="h-7 text-xs"
                />
              </TableCell>
              <TableCell className="py-1.5">
                <Select
                  value={form.watch(`conditions.${idx}.metric`)}
                  onValueChange={(v) =>
                    form.setValue(`conditions.${idx}.metric`, v, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="py-1.5">
                <Select
                  value={form.watch(`conditions.${idx}.operator`)}
                  onValueChange={(v) =>
                    form.setValue(`conditions.${idx}.operator`, v, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o} value={o} className="text-xs font-mono">
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="py-1.5">
                <Input
                  {...form.register(`conditions.${idx}.threshold`, {
                    valueAsNumber: true,
                  })}
                  type="number"
                  step={0.01}
                  className="h-7 text-xs font-mono tabular-nums"
                />
              </TableCell>
              <TableCell className="py-1.5">
                <Select
                  value={form.watch(`conditions.${idx}.action`)}
                  onValueChange={(v) =>
                    form.setValue(`conditions.${idx}.action`, v, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a} value={a} className="text-xs">
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  onClick={() => remove(idx)}
                  aria-label="Remove condition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {fields.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                No conditions defined.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
