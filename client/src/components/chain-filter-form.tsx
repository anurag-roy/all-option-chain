import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { useWebSocketContext } from '@client/contexts/websocket-context';
import { api } from '@client/lib/api';
import { chainFilterSchema } from '@shared/schemas/chain-filter';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

type FilterForm = z.infer<typeof chainFilterSchema>;

export function ChainFilterForm() {
  const { chainStatus, setEntryValue, applyOptionChainData } = useWebSocketContext();
  const [expiries, setExpiries] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FilterForm>({
    resolver: zodResolver(chainFilterSchema),
    defaultValues: {
      expiry: '',
      entryValue: 99,
      orderPercent: 0.5,
      sdMultiplier: 1,
    },
  });

  const watchedEntryValue = form.watch('entryValue');

  useEffect(() => {
    setEntryValue(watchedEntryValue);
  }, [setEntryValue, watchedEntryValue]);

  useEffect(() => {
    api.chain.expiries.$get().then(async (response: Response) => {
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setExpiries(data.expiries);
      if (data.expiries[0]) {
        form.setValue('expiry', data.expiries[0]);
      }
    });
  }, [form]);

  const onSubmit = async (values: FilterForm) => {
    setIsSubmitting(true);
    try {
      const response = await api.chain.filter.$post({ json: values });
      if (!response.ok) {
        const error = await response.json();
        throw new Error('message' in error ? String(error.message) : 'Failed to apply filter');
      }

      const result = await response.json();
      setEntryValue(values.entryValue);
      applyOptionChainData(result.data);
      toast.success(
        result.status.rowCount > 0
          ? `Loaded ${result.status.rowCount} instruments (${result.status.visibleRowCount} match entry value)`
          : 'No instruments with OI found for this expiry'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply filter');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || ['warming', 'fetching_quotes', 'subscribing'].includes(chainStatus);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 p-4 md:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="expiry">Expiry</Label>
        <Select value={form.watch('expiry')} onValueChange={(value) => form.setValue('expiry', value)}>
          <SelectTrigger id="expiry">
            <SelectValue placeholder="Select expiry" />
          </SelectTrigger>
          <SelectContent>
            {expiries.map((expiry) => (
              <SelectItem key={expiry} value={expiry}>
                {expiry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="entryValue">Entry Value</Label>
        <Input
          id="entryValue"
          type="number"
          step="0.05"
          {...form.register('entryValue', { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="orderPercent">Order %</Label>
        <Input
          id="orderPercent"
          type="number"
          step="0.01"
          {...form.register('orderPercent', { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sdMultiplier">SD Multiplier</Label>
        <Input
          id="sdMultiplier"
          type="number"
          step="0.01"
          {...form.register('sdMultiplier', { valueAsNumber: true })}
        />
      </div>

      <div className="flex items-end">
        <Button type="submit" className="w-full" disabled={isBusy || !form.watch('expiry')}>
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            'Apply Filter'
          )}
        </Button>
      </div>
    </form>
  );
}
