import { bondTableClassName } from '@client/components/gsecs/bond-card-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import type { GsecRow } from '@shared/types/gsecs';

export function SellerDepthTable({ row }: { row: GsecRow }) {
  return (
    <Table className={bondTableClassName}>
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
              <TableCell>Seller {index + 1}</TableCell>
              <TableCell className='text-right font-medium'>{level.price.toFixed(2)}</TableCell>
              <TableCell className='text-right'>{level.quantity.toLocaleString('en-IN')}</TableCell>
              <TableCell className='text-right'>{level.orders.toLocaleString('en-IN')}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
