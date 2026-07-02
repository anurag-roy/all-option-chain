import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { useWebSocketContext } from '@client/contexts/websocket-context';
import { useChainExpiries } from '@client/hooks/use-chain-expiries';
import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { zodResolver } from '@hookform/resolvers/zod';
import { chainFilterSchema } from '@shared/schemas/chain-filter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

type FilterForm = z.infer<typeof chainFilterSchema>;

export function ChainFilterForm() {
  const queryClient = useQueryClient();
  const { chainStatus, setEntryValue, applyOptionChainData } = useWebSocketContext();
  const { data: expiriesData } = useChainExpiries();
  const expiries = expiriesData?.expiries ?? [];

  const form = useForm<FilterForm>({
    resolver: zodResolver(chainFilterSchema),
    defaultValues: {
      expiry: '',
      entryValue: 99,
      sdMultiplier: 1,
    },
  });

  const watchedEntryValue = form.watch('entryValue');

  useEffect(() => {
    setEntryValue(watchedEntryValue);
  }, [setEntryValue, watchedEntryValue]);

  useEffect(() => {
    if (expiries[0] && !form.getValues('expiry')) {
      form.setValue('expiry', expiries[0]);
    }
  }, [expiries, form]);

  const applyFilterMutation = useMutation({
    mutationFn: async (values: FilterForm) => {
      const response = await api.chain.filter.$post({ json: values });
      if (!response.ok) {
        const error = await response.json();
        throw new Error('message' in error ? String(error.message) : 'Failed to apply filter');
      }
      return response.json();
    },
    onSuccess: (result, values) => {
      setEntryValue(values.entryValue);
      applyOptionChainData(result.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chain.status });
      toast.success(
        result.status.rowCount > 0
          ? `Loaded ${result.status.rowCount} instruments (${result.status.visibleRowCount} match entry value)`
          : 'No instruments with OI found for this expiry'
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to apply filter');
    },
  });

  const onSubmit = (values: FilterForm) => {
    applyFilterMutation.mutate(values);
  };

  const isBusy = applyFilterMutation.isPending || ['warming', 'fetching_quotes', 'subscribing'].includes(chainStatus);
  const selectedExpiry = form.watch('expiry') || expiries[0] || '';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-8 p-4 md:grid-cols-4'>
      <div className='space-y-2'>
        <Label htmlFor='expiry'>Expiry</Label>
        <Select value={selectedExpiry} onValueChange={(value) => form.setValue('expiry', value!)}>
          <SelectTrigger id='expiry'>
            <SelectValue placeholder='Select expiry' />
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

      <div className='space-y-2'>
        <Label htmlFor='entryValue'>Entry Value</Label>
        <Input id='entryValue' type='number' step='0.05' {...form.register('entryValue', { valueAsNumber: true })} />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='sdMultiplier'>SD Multiplier</Label>
        <Input
          id='sdMultiplier'
          type='number'
          step='0.01'
          {...form.register('sdMultiplier', { valueAsNumber: true })}
        />
      </div>

      <div className='flex items-center'>
        <Button type='submit' className='mt-3 w-full' disabled={isBusy || !selectedExpiry}>
          {isBusy ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' />
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
