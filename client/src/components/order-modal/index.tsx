import { Button } from '@client/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { displayInr } from '@client/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Info, PlusCircle } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import type { OptionChainRow } from '../../types/option-chain';
import { BuyerTable } from './buyer-table';
import { SellerTable } from './seller-table';

interface OrderModalProps {
  row: OptionChainRow;
}

type OrderModalContentProps = OrderModalProps & {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function OrderModalContent({ row, setOpen }: OrderModalContentProps) {
  const [quantity, setQuantity] = React.useState(1);
  const orderQuantity = quantity * row.lotSize;

  const { data: quote } = useQuery({
    queryKey: queryKeys.orders.quote(row.instrumentToken),
    queryFn: async () => {
      const response = await api.orders.quote.$get({ query: { instrumentToken: String(row.instrumentToken) } });
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      return response.json();
    },
  });

  const { data: margin } = useQuery({
    queryKey: queryKeys.orders.margin(row.tradingsymbol, row.bid, orderQuantity),
    queryFn: async () => {
      const response = await api.orders.margin.$post({
        json: {
          tradingsymbol: row.tradingsymbol,
          price: row.bid,
          quantity: orderQuantity,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch margin');
      }
      return response.json();
    },
  });

  const netReturn = React.useMemo(() => {
    if (margin && margin.orderMargin > 0) {
      return (((row.bid - 0.05) * row.lotSize * quantity * 100) / margin.orderMargin).toFixed(2) + '%';
    }
    return '-';
  }, [margin, quantity, row.bid, row.lotSize]);

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await api.orders.sell.$post({
        json: {
          tradingsymbol: row.tradingsymbol,
          price: row.bid,
          quantity: orderQuantity,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to place order');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Order placed successfully!');
      setOpen(false);
    },
    onError: () => {
      toast.error('Error while placing order');
    },
  });

  const remainingCash = margin ? margin.cash - margin.marginUsedPrev - margin.orderMargin : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {row.name} {row.strike}
          {row.instrumentType}
        </DialogTitle>
        <DialogDescription>
          Place sell order for {row.name} {row.strike}
          {row.instrumentType}
        </DialogDescription>
      </DialogHeader>
      <div className='mt-8 mb-8 flex items-start gap-12'>
        <BuyerTable quote={quote ?? null} />
        <div className='mx-auto grid max-w-sm grid-cols-[auto_auto] gap-6'>
          <div className='col-span-2 flex items-center gap-1 rounded-md bg-blue-50/50 px-4 py-3 text-blue-800 ring-1 ring-blue-700/20 ring-inset dark:border-blue-500/30 dark:bg-blue-500/5 dark:text-blue-200'>
            <Info className='h-4 w-4 text-blue-600 dark:text-blue-500' aria-hidden='true' />
            <span className='text-sm font-semibold text-blue-700 dark:text-blue-500'>
              Net Return on this margin is:
            </span>
            <span className='ml-2 text-xl font-bold'>{netReturn}</span>
          </div>
          <div className='rounded-md bg-emerald-50/50 p-4 text-emerald-800 ring-1 ring-emerald-700/20 ring-inset dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200'>
            <h4 className='text-sm font-semibold text-emerald-700 dark:text-emerald-500'>Price</h4>
            <p className='text-2xl font-bold'>{displayInr(row.bid)}</p>
          </div>
          {margin?.insufficientBalance ? (
            <div className='rounded-md bg-red-50/50 p-4 text-red-800 ring-1 ring-red-700/20 ring-inset dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200'>
              <h4 className='text-sm font-semibold text-red-700 dark:text-red-500'>Shortfall</h4>
              <p className='text-2xl font-bold'>{displayInr(Math.abs(remainingCash))}</p>
            </div>
          ) : (
            <>
              <div className='rounded-md bg-zinc-50/50 p-4 text-zinc-800 ring-1 ring-zinc-700/20 ring-inset dark:border-zinc-500/30 dark:bg-zinc-500/5 dark:text-zinc-200'>
                <h4 className='text-sm font-semibold text-zinc-700 dark:text-zinc-500'>Margin</h4>
                <p className='text-2xl font-bold'>{margin ? displayInr(margin.orderMargin) : '-'}</p>
              </div>
              <p className='col-span-2 text-right text-sm font-semibold'>Remaining Cash: {displayInr(remainingCash)}</p>
            </>
          )}
        </div>
        <SellerTable quote={quote ?? null} />
      </div>
      <div className='mx-auto mb-8 grid max-w-sm grid-cols-[repeat(5,auto)] items-center gap-2 px-4'>
        <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Lot Size</span>
        <span />
        <label htmlFor='quantity' className='block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
          Quantity
        </label>
        <span />
        <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Total</span>
        <Input value={row.lotSize} disabled />
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
        <Input value={row.lotSize * quantity} disabled />
      </div>
      <div className='flex flex-row-reverse gap-4'>
        <Button
          type='button'
          size='lg'
          disabled={margin?.insufficientBalance || row.strikePosition > 30 || placeOrderMutation.isPending}
          onClick={() => placeOrderMutation.mutate()}
        >
          Place Sell Order
        </Button>
        <DialogClose
          render={
            <Button type='button' size='lg' variant='ghost'>
              Cancel
            </Button>
          }
        />
      </div>
    </>
  );
}

export function OrderModal({ row }: OrderModalProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant='ghost' className='flex h-8 w-8 p-0 hover:bg-transparent'>
            <PlusCircle className='h-4 w-4' />
            <span className='sr-only'>Open order modal</span>
          </Button>
        }
      />
      <DialogContent className='max-w-5xl'>
        <OrderModalContent row={row} setOpen={setOpen} />
      </DialogContent>
    </Dialog>
  );
}
