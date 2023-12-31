import type { Quote } from '@/types/shoonya';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface Props {
  quote: Quote | null;
}

const indices = [1, 2, 3, 4, 5] as const;

export function BuyerTable({ quote }: Props) {
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
          {quote === null ? (
            <TableRow>
              <TableCell colSpan={3}>No data to display.</TableCell>
            </TableRow>
          ) : (
            indices.map((i) => (
              <TableRow key={i}>
                <TableCell>Buyer {i}</TableCell>
                <TableCell className='bg-blue-50/60 text-right font-semibold tabular-nums text-blue-800 dark:bg-blue-900/10 dark:text-blue-500'>
                  {quote[`bp${i}`] ?? '-'}
                </TableCell>
                <TableCell className='bg-blue-50/60 text-right font-semibold tabular-nums text-blue-800 dark:bg-blue-900/10 dark:text-blue-500'>
                  {quote[`bq${i}`] ?? '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
