import { EXPIRY_OPTION_LENGTH, STOCKS_TO_INCLUDE } from '@/config';
import { getExpiryOptions } from '@/lib/utils';
import { useBansStore } from '@/stores/bans';
import { useStockStore } from '@/stores/stocks';
import type { StockInitResponse } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateIcon } from '@radix-ui/react-icons';
import ky from 'ky';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from './ui/button';
import { Form } from './ui/form';
import { NumberInputFormField } from './ui/number-input-form-field';
import { SelectFormField } from './ui/select-form-field';
import { useToast } from './ui/use-toast';

type ButtonState = 'subscribe' | 'subscribing' | 'subscribed';

const expiryOptions = getExpiryOptions(EXPIRY_OPTION_LENGTH);
const formSchema = z.object({
  expiry: z.string(),
  entryPercent: z.number(),
  entryValue: z.number(),
  orderPercent: z.number(),
});

export function SubscriptionForm() {
  const addEquity = useStockStore((state) => state.addEquity);
  const addInstrument = useStockStore((state) => state.addInstruments);
  const bannedStocks = useBansStore((state) => state.bannedStocks);
  const initSocket = useStockStore((state) => state.initSocket);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      expiry: expiryOptions[0],
      entryPercent: 30,
      entryValue: 99,
      orderPercent: 0.5,
    },
  });
  const [buttonState, setButtonState] =
    React.useState<ButtonState>('subscribe');
  const { toast } = useToast();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setButtonState('subscribing');
    const { expiry, entryPercent } = values;
    for (const stock of STOCKS_TO_INCLUDE) {
      if (bannedStocks.includes(stock)) {
        console.log('Skipping banned stock', stock);
        continue;
      }

      console.log('Fetching init data for', stock);
      const { equity, instruments } = await ky
        .get('/api/stockInit', {
          searchParams: {
            stock,
            expiry,
            entryPercent,
          },
        })
        .json<StockInitResponse>();
      addEquity(equity);
      addInstrument(instruments);
    }

    setButtonState('subscribed');
    toast({
      title: 'All set!',
      description: 'Instruments fetched for all stocks',
    });

    initSocket();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="p-4 flex gap-4 justify-between"
      >
        <SelectFormField form={form} name="expiry" options={expiryOptions} />
        <NumberInputFormField
          form={form}
          name="entryPercent"
          min={0}
          max={100}
          step={1}
        />
        <NumberInputFormField
          form={form}
          name="entryValue"
          min={0}
          max={10000}
          step={0.05}
        />
        <NumberInputFormField
          form={form}
          name="orderPercent"
          min={0}
          max={100}
          step={0.01}
        />
        <Button
          type="submit"
          className="mt-[30px]"
          disabled={buttonState !== 'subscribe'}
        >
          {buttonState === 'subscribe' ? 'Subscribe' : null}
          {buttonState === 'subscribing' ? (
            <>
              <UpdateIcon className="mr-2 h-4 w-4 animate-spin" />
              Subscribing...
            </>
          ) : null}
          {buttonState === 'subscribed' ? 'Subscribed!' : null}
        </Button>
      </form>
    </Form>
  );
}
