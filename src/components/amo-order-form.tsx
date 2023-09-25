import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import type { instrument } from '@prisma/client';
import { CaretSortIcon, CheckIcon, UpdateIcon } from '@radix-ui/react-icons';
import ky from 'ky';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

type AmoOrderFormProps = {
  equityStocks: instrument[];
};

const formSchema = z.object({
  stock: z.string(),
  value: z.number(),
  ltp: z.number(),
  lowerCircuit: z.number(),
  leg1: z.number(),
  leg2: z.number(),
  leg3: z.number(),
});

const calculateOrders = (
  values: z.infer<typeof formSchema>,
  tradingSymbol: string
) => {
  const { value, ltp, lowerCircuit, leg1, leg2, leg3 } = values;
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
    tradingSymbol,
    price: p,
    quantity,
  }));
};

export function AmoOrderForm({ equityStocks }: AmoOrderFormProps) {
  const [buttonState, setButtonState] = React.useState<'order' | 'ordering'>(
    'order'
  );
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setButtonState('ordering');

    const tradingSymbol = equityStocks.find(
      (eq) => eq.symbol === values.stock
    )!.tradingSymbol;
    const orders = calculateOrders(values, tradingSymbol);
    const orderApiCalls = orders.map((o) =>
      ky.post('/api/buyAmo', { json: o })
    );
    await Promise.allSettled(orderApiCalls);
    setButtonState('order');
  };

  return (
    <>
      <h1 className="text-xl font-bold mb-2 ml-1">Place After Market Order</h1>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="border rounded-md p-4 flex gap-8 justify-between"
        >
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem className="flex flex-col space-y-4">
                <FormLabel>Stock</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'w-[200px] justify-between',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? equityStocks.find((eq) => eq.symbol === field.value)
                              ?.symbol
                          : 'Select Stock'}
                        <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search stocks..."
                        className="h-9"
                      />
                      <CommandEmpty>No stock found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {equityStocks.map((eq) => (
                          <CommandItem
                            value={eq.symbol}
                            key={eq.symbol}
                            onSelect={() => {
                              form.setValue('stock', eq.symbol);
                            }}
                          >
                            {eq.symbol}
                            <CheckIcon
                              className={cn(
                                'ml-auto h-4 w-4',
                                eq.symbol === field.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
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
            name="value"
            render={() => (
              <FormItem>
                <FormLabel>Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-32"
                    step={0.01}
                    {...form.register('value', { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ltp"
            render={() => (
              <FormItem>
                <FormLabel>LTP</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-32"
                    step={0.01}
                    {...form.register('ltp', { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lowerCircuit"
            render={() => (
              <FormItem>
                <FormLabel>Lower Circuit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-32"
                    step={0.01}
                    {...form.register('lowerCircuit', {
                      valueAsNumber: true,
                    })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leg1"
            render={() => (
              <FormItem>
                <FormLabel>Leg 1</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-24"
                    step={0.01}
                    {...form.register('leg1', { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leg2"
            render={() => (
              <FormItem>
                <FormLabel>Leg 2</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-24"
                    step={0.01}
                    {...form.register('leg2', { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leg3"
            render={() => (
              <FormItem>
                <FormLabel>Leg 3</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="w-24"
                    step={0.01}
                    {...form.register('leg3', { valueAsNumber: true })}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="mt-[30px] ml-auto"
            disabled={buttonState !== 'order'}
          >
            {buttonState === 'order' ? 'Order' : null}
            {buttonState === 'ordering' ? (
              <>
                <UpdateIcon className="mr-2 h-4 w-4 animate-spin" />
                Ordering...
              </>
            ) : null}
          </Button>
        </form>
      </Form>
    </>
  );
}
