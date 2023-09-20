import { EXPIRY_OPTION_LENGTH, STOCKS_TO_INCLUDE } from '@/config';
import { getExpiryOptions } from '@/lib/utils';
import { useBansStore } from '@/stores/bans';
import { useStockStore } from '@/stores/stocks';
import type { StockInitResponse } from '@/types';
import { TouchlineResponse } from '@/types/shoonya';
import { zodResolver } from '@hookform/resolvers/zod';
import ky from 'ky';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from './ui/button';
import { Form } from './ui/form';
import { NumberInputFormField } from './ui/number-input-form-field';
import { SelectFormField } from './ui/select-form-field';
import { useToast } from './ui/use-toast';

const expiryOptions = getExpiryOptions(EXPIRY_OPTION_LENGTH);
const formSchema = z.object({
  expiry: z.string(),
  entryPercent: z.number(),
  entryValue: z.number(),
  orderPercent: z.number(),
});

export function SubscriptionForm() {
  const addEquity = useStockStore((state) => state.addEquity);
  const updateLtp = useStockStore((state) => state.updateLtp);
  const addInstrument = useStockStore((state) => state.addInstruments);
  const updateInstrumentBid = useStockStore((state) => state.updateBid);
  const bannedStocks = useBansStore((state) => state.bannedStocks);
  const ws = useStockStore((state) => state.socket);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      expiry: expiryOptions[0],
      entryPercent: 30,
      entryValue: 99,
      orderPercent: 0.5,
    },
  });
  const { toast } = useToast();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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
      ws?.send(
        JSON.stringify({
          t: 't',
          k: `NSE|${equity.token}`,
        })
      );

      addInstrument(instruments);
      ws?.send(
        JSON.stringify({
          t: 't',
          k: instruments.map((i) => `NFO|${i.token}`).join('#'),
        })
      );
    }

    toast({
      title: 'All set!',
      description: 'Instruments fetched for all stocks',
    });

    if (ws) {
      ws.onmessage = (event) => {
        const messageData = JSON.parse(event.data as string);
        if (messageData.t !== 'tf') return;

        const data = messageData as TouchlineResponse;
        if (data.e === 'NSE' && 'lp' in data) {
          updateLtp(data);
        } else if (data.e === 'NFO' && 'bp1' in data) {
          updateInstrumentBid(data);
        }
      };
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-6xl mx-auto p-4 flex gap-4 justify-between"
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
        <Button type="submit" className="mt-[30px]">
          Subscribe
        </Button>
      </form>
    </Form>
  );
}
