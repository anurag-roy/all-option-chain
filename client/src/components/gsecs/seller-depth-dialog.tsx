import { Button } from '@client/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@client/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import type { GsecRow } from '@shared/types/gsecs';
import { useState } from 'react';

function SellerDepth({ row, isLive }: { row: GsecRow; isLive: boolean }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{row.tradingsymbol}</DialogTitle>
      </DialogHeader>
      {!isLive ? (
        <p role='status' className='text-muted-foreground text-sm'>
          Live updates disconnected. Showing the last received seller prices.
        </p>
      ) : null}
      <div className='rounded-md border'>
        <Table className='tabular-nums'>
          <TableHeader>
            <TableRow>
              <TableHead>Seller</TableHead>
              <TableHead className='text-right'>Sell price</TableHead>
              <TableHead className='text-right'>Quantity</TableHead>
              <TableHead className='text-right'>Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!row.sellerDepth.length ? (
              <TableRow>
                <TableCell colSpan={4} className='text-muted-foreground py-8 text-center'>
                  {row.quoteStatus === 'unavailable' ? 'Seller quote unavailable.' : 'No sellers available.'}
                </TableCell>
              </TableRow>
            ) : (
              row.sellerDepth.map((level, index) => (
                <TableRow key={index}>
                  <TableCell>
                    Seller {index + 1}
                    {index === 0 ? ' (best)' : ''}
                  </TableCell>
                  <TableCell className='text-right font-medium'>{level.price.toFixed(2)}</TableCell>
                  <TableCell className='text-right'>{level.quantity.toLocaleString('en-IN')}</TableCell>
                  <TableCell className='text-right'>{level.orders.toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function SellerDepthDialog({ row, isLive }: { row: GsecRow; isLive: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant='outline' size='sm' className='min-h-10 transition-colors' />}
        aria-label={`Open seller market depth for ${row.tradingsymbol}`}
      >
        Market depth
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>{open ? <SellerDepth row={row} isLive={isLive} /> : null}</DialogContent>
    </Dialog>
  );
}
