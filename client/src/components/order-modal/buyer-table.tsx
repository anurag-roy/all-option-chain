import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import type { OrderQuoteResponse } from '@shared/schemas/orders';

interface Props {
  quote: OrderQuoteResponse | null;
}

export function BuyerTable({ quote }: Props) {
  const levels = quote?.buy ?? [];

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='min-w-[100px]'>Buyer</TableHead>
            <TableHead className='min-w-[8ch] text-right'>Bid</TableHead>
            <TableHead className='min-w-[8ch] text-right'>Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {levels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>No data to display.</TableCell>
            </TableRow>
          ) : (
            levels.map((level, index) => (
              <TableRow key={index}>
                <TableCell>Buyer {index + 1}</TableCell>
                <TableCell className='bg-blue-50/60 text-right font-semibold text-blue-800 tabular-nums dark:bg-blue-900/10 dark:text-blue-500'>
                  {level.price}
                </TableCell>
                <TableCell className='bg-blue-50/60 text-right font-semibold text-blue-800 tabular-nums dark:bg-blue-900/10 dark:text-blue-500'>
                  {level.quantity}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
