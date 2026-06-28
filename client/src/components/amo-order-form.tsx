import { Button } from '@client/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@client/components/ui/combobox';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Switch } from '@client/components/ui/switch';
import { useEquitySymbols } from '@client/hooks/use-equity-symbols';
import { api } from '@client/lib/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { calculateAmoOrders } from '@shared/lib/calculate-amo-orders';
import { amoFormSchema, type AmoFormValues, type AmoStockRow } from '@shared/schemas/amo';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MinusCircle, Plus } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

const emptyRow: AmoStockRow = {
  isAmo: true,
  tradingsymbol: '',
  value: 0,
  ltp: 0,
  lowerCircuit: 0,
  leg1: 0,
  leg2: 0,
  leg3: 0,
};

export function AmoOrderForm() {
  const { data, isLoading } = useEquitySymbols();
  const equityOptions = data?.equities.map((equity) => equity.tradingsymbol) ?? [];

  const form = useForm<AmoFormValues>({
    resolver: zodResolver(amoFormSchema),
    defaultValues: {
      stocks: [{ ...emptyRow }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: 'stocks',
    control: form.control,
  });

  const placeOrdersMutation = useMutation({
    mutationFn: async (values: AmoFormValues) => {
      const orders = values.stocks.flatMap((stock) => calculateAmoOrders(stock));
      if (orders.length === 0) {
        throw new Error('No orders generated. Check your ladder inputs.');
      }

      const response = await api.orders.amo.$post({ json: { orders } });
      if (!response.ok) {
        const error = await response.json();
        throw new Error('message' in error ? String(error.message) : 'Failed to place orders');
      }
      return response.json();
    },
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.warning(`Placed ${result.placed} orders, ${result.failed} failed`);
      } else {
        toast.success(`Placed ${result.placed} orders successfully`);
      }
      form.reset({ stocks: [{ ...emptyRow }] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to place orders');
    },
  });

  const onSubmit = (values: AmoFormValues) => {
    placeOrdersMutation.mutate(values);
  };

  return (
    <div className='border-border bg-card rounded-md border'>
      <div className='flex items-center justify-between border-b p-4'>
        <div>
          <h1 className='text-xl font-bold'>Place After Market Order</h1>
          <p className='text-muted-foreground text-sm'>Laddered limit buy orders via Zerodha Kite (CNC delivery)</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className='p-4'>
        <div className='rounded-md border'>
          {fields.map((field, index) => (
            <section
              key={field.id}
              className='flex flex-wrap items-start justify-between gap-4 border-b p-4 last:border-b-0 lg:flex-nowrap'
            >
              <div className='flex flex-col gap-2 pt-2'>
                <Label htmlFor={`stocks.${index}.isAmo`}>AMO</Label>
                <Controller
                  control={form.control}
                  name={`stocks.${index}.isAmo`}
                  render={({ field: switchField }) => (
                    <Switch
                      id={`stocks.${index}.isAmo`}
                      checked={switchField.value}
                      onCheckedChange={switchField.onChange}
                    />
                  )}
                />
              </div>

              <div className='min-w-[200px] flex-1 space-y-2'>
                <Label>Trading Symbol</Label>
                <Controller
                  control={form.control}
                  name={`stocks.${index}.tradingsymbol`}
                  render={({ field: comboboxField }) => (
                    <Combobox
                      items={equityOptions}
                      value={comboboxField.value || null}
                      onValueChange={(value) => comboboxField.onChange(value ?? '')}
                      disabled={isLoading}
                    >
                      <ComboboxInput
                        placeholder={isLoading ? 'Loading stocks...' : 'Select stock'}
                        className='w-full'
                        showClear
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No stock found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  )}
                />
                {form.formState.errors.stocks?.[index]?.tradingsymbol ? (
                  <p className='text-destructive text-xs'>
                    {form.formState.errors.stocks[index]?.tradingsymbol?.message}
                  </p>
                ) : null}
              </div>

              {(['value', 'ltp', 'lowerCircuit'] as const).map((name) => (
                <div key={name} className='space-y-2'>
                  <Label htmlFor={`stocks.${index}.${name}`}>
                    {name === 'lowerCircuit' ? 'Lower Circuit' : name.toUpperCase()}
                  </Label>
                  <Input
                    id={`stocks.${index}.${name}`}
                    type='number'
                    step='0.01'
                    className='w-32'
                    {...form.register(`stocks.${index}.${name}`, { valueAsNumber: true })}
                  />
                </div>
              ))}

              {(['leg1', 'leg2', 'leg3'] as const).map((name) => (
                <div key={name} className='space-y-2'>
                  <Label htmlFor={`stocks.${index}.${name}`}>{name.replace('leg', 'Leg ')}</Label>
                  <Input
                    id={`stocks.${index}.${name}`}
                    type='number'
                    step='0.01'
                    className='w-24'
                    {...form.register(`stocks.${index}.${name}`, { valueAsNumber: true })}
                  />
                </div>
              ))}

              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='mt-3 shrink-0 self-center'
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <MinusCircle className='size-4' />
                <span className='sr-only'>Remove row</span>
              </Button>
            </section>
          ))}
        </div>

        <div className='flex items-center justify-end gap-4 py-4'>
          <Button type='button' variant='destructive' className='mr-auto' onClick={() => form.reset()}>
            Reset
          </Button>
          <Button type='button' variant='outline' onClick={() => append({ ...emptyRow })}>
            <Plus className='mr-2 size-4' />
            Add row
          </Button>
          <Button type='submit' disabled={placeOrdersMutation.isPending}>
            {placeOrdersMutation.isPending ? (
              <>
                <Loader2 className='mr-2 size-4 animate-spin' />
                Placing orders...
              </>
            ) : (
              'Place orders on Kite'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
