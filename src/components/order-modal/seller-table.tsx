import { Quote } from '@/types/shoonya';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface Props {
  quote: Quote | null;
}

const indices = [1, 2, 3, 4, 5] as const;

export function SellerTable({ quote }: Props) {
  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='min-w-[100px]'>Seller</TableHead>
            <TableHead className='min-w-[8ch]'>Ask</TableHead>
            <TableHead className='min-w-[8ch]'>Qty</TableHead>
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
                <TableCell>Seller {i}</TableCell>
                <TableCell className='bg-red-50/60 text-red-800 dark:bg-red-900/10 dark:text-red-500'>
                  {quote[`sp${i}`] ?? '-'}
                </TableCell>
                <TableCell className='bg-red-50/60 text-red-800 dark:bg-red-900/10 dark:text-red-500'>
                  {quote[`sq${i}`] ?? '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
