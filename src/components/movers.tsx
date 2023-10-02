import { cn } from '@/lib/utils';
import { useStockStore } from '@/stores/stocks';
import { UiEquity } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

function MoversTableBody({ rows, type }: { rows: UiEquity[]; type: 'gainers' | 'losers' }) {
  const classNames = cn(
    'tabular-nums font-semibold text-right',
    type === 'gainers'
      ? 'bg-emerald-50/60 text-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-500'
      : 'bg-red-50/60 text-red-800 dark:bg-red-900/10 dark:text-red-500'
  );

  return (
    <TableBody>
      {[0, 1, 2, 3, 4].map((i) =>
        rows[i] ? (
          <TableRow key={rows[i].symbol}>
            <TableCell className='font-semibold'>{rows[i].symbol}</TableCell>
            <TableCell className={classNames}>{rows[i].ltp.toFixed(2)}</TableCell>
            <TableCell className={classNames}>
              {type === 'losers' ? '↓ ' : '↑ '}
              {rows[i].gainLossPercent.toFixed(2)}
            </TableCell>
          </TableRow>
        ) : (
          <TableRow key={i}>
            <TableCell>-</TableCell>
            <TableCell className={classNames}>-</TableCell>
            <TableCell className={classNames}>-</TableCell>
          </TableRow>
        )
      )}
    </TableBody>
  );
}

function Gainers() {
  const equities = useStockStore((state) => state.equities);
  const gainers = [...equities]
    .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
    .filter((equity) => equity.gainLossPercent > 0)
    .slice(0, 5);

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gainers</TableHead>
            <TableHead className='text-right'>LTP</TableHead>
            <TableHead className='text-right'>Gain %</TableHead>
          </TableRow>
        </TableHeader>
        <MoversTableBody rows={gainers} type='gainers' />
      </Table>
    </div>
  );
}

function Losers() {
  const equities = useStockStore((state) => state.equities);
  const losers = [...equities]
    .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
    .filter((equity) => equity.gainLossPercent < 0)
    .slice(0, 5);

  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Losers</TableHead>
            <TableHead className='text-right'>LTP</TableHead>
            <TableHead className='text-right'>Loss %</TableHead>
          </TableRow>
        </TableHeader>
        <MoversTableBody rows={losers} type='losers' />
      </Table>
    </div>
  );
}

export function Movers() {
  return (
    <section>
      <h2 className='mb-2 ml-1 text-xl font-bold'>Movers</h2>
      <div className='grid grid-cols-2 gap-4 rounded-md border p-4'>
        <Gainers />
        <Losers />
      </div>
    </section>
  );
}
