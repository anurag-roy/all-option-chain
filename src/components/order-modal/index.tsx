import { displayInr } from '@/lib/utils';
import { UiInstrument } from '@/types';
import { Margin, Quote } from '@/types/shoonya';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { InfoCircledIcon, PlusCircledIcon } from '@radix-ui/react-icons';
import ky from 'ky';
import * as React from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { BuyerTable } from './buyer-table';
import { SellerTable } from './seller-table';

interface OrderModalProps {
  i: UiInstrument;
}

type OrderModalContentProps = OrderModalProps & {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function OrderModalContent({ i, setOpen }: OrderModalContentProps) {
  const [quantity, setQuantity] = React.useState(1);
  const [margin, setMargin] = React.useState<Margin | null>(null);
  const [netReturn, setNetReturn] = React.useState<string>('-');
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    ky.get('/api/quote', {
      searchParams: {
        exchange: 'NFO',
        token: i.token,
      },
    })
      .json<Quote>()
      .then(setQuote);
  }, []);

  React.useEffect(() => {
    ky.get('/api/margin', {
      searchParams: {
        price: i.bid,
        quantity: quantity * i.lotSize,
        tradingSymbol: encodeURIComponent(i.tradingSymbol),
      },
    })
      .json<Margin>()
      .then(setMargin);
  }, [quantity]);

  React.useEffect(() => {
    if (margin) {
      const returnValue = (((i.bid - 0.05) * i.lotSize * quantity * 100) / Number(margin.ordermargin)).toFixed(2) + '%';
      setNetReturn(returnValue);
    } else {
      setNetReturn('-');
    }
  }, [margin]);

  const placeSellOrder = async () => {
    try {
      await ky.post('/api/sell', {
        json: {
          price: i.bid,
          quantity: i.lotSize * quantity,
          tradingSymbol: i.tradingSymbol,
        },
      });
      toast({
        title: 'Order placed successfully!',
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error while placing order',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {i.symbol} {i.strikePrice}
          {i.optionType}
        </DialogTitle>
        <DialogDescription>
          Place sell order for {i.symbol} {i.strikePrice}
          {i.optionType}
        </DialogDescription>
      </DialogHeader>
      <div className='mb-8 mt-8 flex items-start gap-12'>
        <BuyerTable quote={quote} />
        <div className='mx-auto grid max-w-sm grid-cols-[auto,_auto] gap-6'>
          <div className='col-span-2 flex items-center gap-1 rounded-md bg-blue-50/50 px-4 py-3 text-blue-800 ring-1 ring-inset ring-blue-700/20 dark:border-blue-500/30 dark:bg-blue-500/5 dark:text-blue-200'>
            <InfoCircledIcon className='h-4 w-4 fill-blue-600 dark:fill-blue-200/50' aria-hidden='true' />
            <span className='text-sm font-semibold text-blue-700 dark:text-blue-500'>
              Net Return on this margin is:
            </span>
            <span className='ml-2 text-xl font-bold'>{netReturn}</span>
          </div>
          <div className='rounded-md bg-emerald-50/50 p-4 text-emerald-800 ring-1 ring-inset ring-emerald-700/20 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200'>
            <h4 className='text-sm font-semibold text-emerald-700 dark:text-emerald-500'>Price</h4>
            <p className='text-2xl font-bold'>{displayInr(i.bid)}</p>
          </div>
          {margin?.remarks === 'Insufficient Balance' ? (
            <div className='rounded-md bg-red-50/50 p-4 text-red-800 ring-1 ring-inset ring-red-700/20 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200'>
              <h4 className='text-sm font-semibold text-red-700 dark:text-red-500'>Shortfall</h4>
              <p className='text-2xl font-bold'>{margin ? displayInr(Number(margin.marginused)) : '-'}</p>
            </div>
          ) : (
            <>
              <div className='rounded-md bg-zinc-50/50 p-4 text-zinc-800 ring-1 ring-inset ring-zinc-700/20 dark:border-zinc-500/30 dark:bg-zinc-500/5 dark:text-zinc-200'>
                <h4 className='text-sm font-semibold text-zinc-700 dark:text-zinc-500'>Margin</h4>
                <p className='text-2xl font-bold'>{margin ? displayInr(Number(margin.ordermargin)) : '-'}</p>
              </div>
              <p className='col-span-2 text-right text-sm font-semibold'>
                Remaining Cash:{' '}
                {displayInr(Number(margin?.cash) - Number(margin?.marginusedprev) - Number(margin?.ordermargin))}
              </p>
            </>
          )}
        </div>
        <SellerTable quote={quote} />
      </div>
      <div className='mx-auto mb-8 grid max-w-sm grid-cols-[repeat(5,_auto)] items-center gap-2 px-4'>
        <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Lot Size</span>
        <span></span>
        <label htmlFor='quantity' className='block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
          Quantity
        </label>
        <span></span>
        <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Total</span>
        <Input value={i.lotSize} disabled />
        <span className='text-sm font-medium text-zinc-500'>×</span>
        <Input
          type='number'
          name='quantity'
          id='quantity'
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <span className='text-sm font-medium text-zinc-500'>=</span>
        <Input value={i.lotSize * quantity} disabled />
      </div>
      <div className='flex flex-row-reverse gap-4'>
        <Button
          type='button'
          size='lg'
          disabled={margin?.remarks === 'Insufficient Balance' || i.strikePosition > 30}
          onClick={placeSellOrder}
        >
          Place Sell Order
        </Button>
        <DialogPrimitive.Close asChild>
          <Button type='button' size='lg' variant='ghost'>
            Cancel
          </Button>
        </DialogPrimitive.Close>
      </div>
    </>
  );
}

export function OrderModal({ i }: OrderModalProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' className='flex h-8 w-8 p-0 hover:bg-transparent'>
          <PlusCircledIcon className='h-4 w-4' />
          <span className='sr-only'>Open order modal</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-5xl'>
        <OrderModalContent i={i} setOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
