import type { Quote } from '@/types/shoonya';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Props {
  quote: Quote | null;
}

const indices = [1, 2, 3, 4, 5] as const;

export function BuyerTable({ quote }: Props) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px]">Buyer</TableHead>
            <TableHead className="min-w-[8ch]">Bid</TableHead>
            <TableHead className="min-w-[8ch]">Qty</TableHead>
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
                <TableCell className="bg-blue-50/60 dark:bg-blue-900/5 text-blue-800 dark:text-blue-500">
                  {quote[`bp${i}`] ?? '-'}
                </TableCell>
                <TableCell className="bg-blue-50/60 dark:bg-blue-900/5 text-blue-800 dark:text-blue-500">
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
