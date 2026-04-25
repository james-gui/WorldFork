'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const schema = z.object({
  url: z.string().url('Must be a valid URL'),
  secret: z.string().min(1, 'Secret required'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
});

type WebhookFormValues = z.infer<typeof schema>;

const ALL_EVENTS = [
  'run.created', 'run.completed', 'tick.completed',
  'branch.created', 'branch.killed', 'job.failed',
];

interface WebhookEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<WebhookFormValues>;
}

export function WebhookEditDialog({ open, onOpenChange, initial }: WebhookEditDialogProps) {
  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      url: initial?.url ?? '',
      secret: initial?.secret ?? '',
      events: initial?.events ?? [],
    },
  });

  const selectedEvents = form.watch('events');

  const toggleEvent = (evt: string) => {
    const cur = form.getValues('events');
    form.setValue(
      'events',
      cur.includes(evt) ? cur.filter((e) => e !== evt) : [...cur, evt],
      { shouldDirty: true }
    );
  };

  const onSubmit = async (values: WebhookFormValues) => {
    await new Promise((r) => setTimeout(r, 200));
    toast.success('Webhook saved.');
    console.info('webhook:', values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Endpoint URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com/webhook" className="text-xs" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Secret</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="whsec_…" className="text-xs font-mono" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="events"
              render={() => (
                <FormItem>
                  <FormLabel className="text-xs">Events</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_EVENTS.map((evt) => (
                      <button
                        key={evt}
                        type="button"
                        onClick={() => toggleEvent(evt)}
                        className="focus:outline-none"
                      >
                        <Badge
                          variant={selectedEvents.includes(evt) ? 'default' : 'outline'}
                          className="text-xs cursor-pointer"
                        >
                          {evt}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">Save webhook</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
