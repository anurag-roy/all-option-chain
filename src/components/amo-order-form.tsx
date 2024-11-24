import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getKiteBasket } from '@/lib/kite';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { CaretSortIcon, CheckIcon, MinusCircledIcon, PlusIcon, UpdateIcon } from '@radix-ui/react-icons';
import ky from 'ky';
import pQueue from 'p-queue';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './ui/command';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useToast } from './ui/use-toast';

type AmoOrderFormProps = {
  equityStockOptions: string[];
};

const requiredNumber = z.number({ invalid_type_error: 'Required' });
const formSchema = z.object({
  stocks: z.array(
    z.object({
      isAmo: z.boolean(),
      tradingSymbol: z.string(),
      value: requiredNumber,
      ltp: requiredNumber,
      lowerCircuit: requiredNumber,
      leg1: requiredNumber,
      leg2: requiredNumber,
      leg3: requiredNumber,
    })
  ),
});
type FormObject = z.infer<typeof formSchema.shape.stocks>[number];
const defaultValues: FormObject = {
  isAmo: false,
  tradingSymbol: undefined,
  value: undefined,
  ltp: undefined,
  lowerCircuit: undefined,
  leg1: undefined,
  leg2: undefined,
  leg3: undefined,
} as any;

const calculateOrders = (values: FormObject) => {
  const { isAmo, tradingSymbol, value, ltp, lowerCircuit, leg1, leg2, leg3 } = values;
  const prices: number[] = [];
  let currentValue = ltp;
  let totalValue = 0;

  const addPrice = (diff: number) => {
    currentValue = Number((currentValue - diff).toFixed(2));
    totalValue += currentValue;
    prices.push(currentValue);
  };

  addPrice(leg1);

  while (currentValue >= lowerCircuit && totalValue < value) {
    addPrice(leg2);
    if (currentValue < lowerCircuit || totalValue > value) break;
    addPrice(leg3);
  }

  const lastPrice = prices.pop()!;
  totalValue = Number((totalValue - lastPrice).toFixed(2));
  const quantity = Math.max(Math.floor(value / totalValue), 1);
  return prices.map((p) => ({
    isAmo,
    tradingSymbol,
    price: p,
    quantity,
  }));
};

export function AmoOrderForm({ equityStockOptions }: AmoOrderFormProps) {
  const [broker, setBroker] = React.useState<'shoonya' | 'zerodha'>('shoonya');
  const [buttonState, setButtonState] = React.useState<'order' | 'ordering'>('order');
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stocks: [{ ...defaultValues }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    name: 'stocks',
    control: form.control,
  });

  const addRow = () => {
    append({ ...defaultValues });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const ordersArray = values.stocks.map((s) => calculateOrders(s));

    if (broker === 'shoonya') {
      setButtonState('ordering');
      const orders = ordersArray.flat();
      const queue = new pQueue({ concurrency: 1, intervalCap: 1, interval: 300 });
      for (const order of orders) {
        queue.add(async () => {
          try {
            await ky.post('/api/buyAmo', { json: order });
          } catch (error) {
            toast({
              title: 'Error',
              description: `Failed to place order for ${order.tradingSymbol} at ${order.price} with quantity ${order.quantity}`,
            });
          }
        });
      }
      await queue.onIdle();

      toast({
        title: 'Complete!',
        description: `Placed ${orders.length} AMOs. Please check the console for more details.`,
      });
      setButtonState('order');
      form.setValue('stocks', [{ ...defaultValues }]);
    } else {
      const url = new URL('/kite', window.location.href);
      for (const orders of ordersArray) {
        const basketValue = getKiteBasket(orders);
        url.searchParams.set('data', JSON.stringify(basketValue));
        window.open(url, '_blank', `left=20,top=20,width=850,height=550,toolbar=1,resizable=0`);
      }
    }
  };

  return (
    <>
      <div className='mb-4 flex items-center justify-between'>
        <h1 className='ml-1 text-xl font-bold'>Place After Market Order</h1>
        <Select value={broker} onValueChange={(value) => setBroker(value as 'shoonya' | 'zerodha')}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Broker' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='shoonya'>Shoonya</SelectItem>
            <SelectItem value='zerodha'>Zerodha</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className='rounded-md border'>
            {fields.map((field, index) => (
              <section key={field.id} className='flex justify-between gap-8 border-b p-4'>
                <FormField
                  control={form.control}
                  name={`stocks.${index}.isAmo`}
                  render={({ field }) => (
                    <FormItem className='flex flex-col gap-2 pt-2'>
                      <FormLabel>AMO</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.tradingSymbol`}
                  render={({ field }) => (
                    <FormItem className='space-y-2'>
                      <FormLabel>Trading Symbol</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant='outline'
                              role='combobox'
                              className={cn('flex w-[200px] justify-between', !field.value && 'text-muted-foreground')}
                            >
                              {field.value ? equityStockOptions.find((eq) => eq === field.value) : 'Select Stock'}
                              <CaretSortIcon className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className='w-[200px] p-0'>
                          <Command>
                            <CommandInput placeholder='Search...' className='h-9' />
                            <CommandEmpty>No stock found.</CommandEmpty>
                            <CommandGroup className='max-h-64 overflow-auto'>
                              {equityStockOptions.map((eq) => (
                                <CommandItem
                                  value={eq}
                                  key={eq}
                                  onSelect={() => form.setValue(`stocks.${index}.tradingSymbol`, eq)}
                                >
                                  {eq}
                                  <CheckIcon
                                    className={cn('ml-auto h-4 w-4', eq === field.value ? 'opacity-100' : 'opacity-0')}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.value`}
                  render={() => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-32'
                          step={0.01}
                          {...form.register(`stocks.${index}.value`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.ltp`}
                  render={() => (
                    <FormItem>
                      <FormLabel>LTP</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-32'
                          step={0.01}
                          {...form.register(`stocks.${index}.ltp`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.lowerCircuit`}
                  render={() => (
                    <FormItem>
                      <FormLabel>Lower Circuit</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-32'
                          step={0.01}
                          {...form.register(`stocks.${index}.lowerCircuit`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.leg1`}
                  render={() => (
                    <FormItem>
                      <FormLabel>Leg 1</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-24'
                          step={0.01}
                          {...form.register(`stocks.${index}.leg1`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.leg2`}
                  render={() => (
                    <FormItem>
                      <FormLabel>Leg 2</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-24'
                          step={0.01}
                          {...form.register(`stocks.${index}.leg2`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`stocks.${index}.leg3`}
                  render={() => (
                    <FormItem>
                      <FormLabel>Leg 3</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          className='w-24'
                          step={0.01}
                          {...form.register(`stocks.${index}.leg3`, { valueAsNumber: true })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type='button'
                  variant='ghost'
                  className='mt-[30px]'
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <MinusCircledIcon className='h-4 w-4' />
                </Button>
              </section>
            ))}
          </div>
          <div className='flex items-center justify-end gap-4 py-4'>
            <Button type='button' variant='destructive' className='mr-auto' onClick={() => form.reset()}>
              Reset
            </Button>
            <Button type='button' onClick={() => addRow()}>
              <PlusIcon className='mr-2 h-4 w-4' />
              Add row
            </Button>
            <Button
              type='submit'
              disabled={buttonState !== 'order'}
              variant={broker === 'zerodha' ? 'zerodha' : 'default'}
            >
              {buttonState === 'order'
                ? broker === 'zerodha'
                  ? 'Place orders on Zerodha'
                  : 'Place orders on Shoonya'
                : null}
              {buttonState === 'ordering' ? (
                <>
                  <UpdateIcon className='mr-2 h-4 w-4 animate-spin' />
                  Placing orders...
                </>
              ) : null}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
