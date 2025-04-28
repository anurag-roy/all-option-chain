import { cn } from '@/lib/utils';
import { UiInstrument } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from './column-header';
import { RowOrderAction } from './order-action';

export const columns: ColumnDef<UiInstrument>[] = [
  {
    id: 'optionStrike',
    header: 'Option Strike',
    accessorFn: (row) => `${row.symbol} ${row.strikePrice}${row.optionType}`,
  },
  {
    accessorKey: 'symbol',
    header: 'Stock',
  },
  {
    accessorKey: 'ltp',
    header: 'LTP',
    cell: ({ row }) => row.original.ltp.toFixed(2),
  },
  {
    id: 'dv',
    header: 'DV',
    cell: ({ row }) => {
      const dv = row.original.dv;
      let bg = 'bg-white';
      const ltpChangePercent = row.original.gainLossPercent;
      if (dv && ltpChangePercent) {
        const [min, max] = [dv, dv * -1].sort((a, b) => a - b);
        if (ltpChangePercent >= min && ltpChangePercent <= max) {
          bg = 'ring-emerald-100 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-500';
        } else {
          bg = 'ring-red-100 bg-red-50/60 text-red-800 dark:bg-red-900/10 dark:text-red-500';
        }
      }
      return <div className={cn('rounded-full text-center ring-1 ring-gray-100', bg)}>{row.original.dv}</div>;
    },
  },
  {
    accessorKey: 'strikePrice',
    header: 'Strike',
    cell: ({ row }) => `${row.original.strikePrice} ${row.original.optionType}`,
  },
  {
    accessorKey: 'bid',
    header: 'Buyer Price',
    cell: ({ row }) => row.original.bid.toFixed(2),
  },
  {
    accessorKey: 'returnValue',
    header: ({ table, column }) => <DataTableColumnHeader table={table} column={column} title='Return Value' />,
    cell: ({ row }) => <RowOrderAction row={row} />,
    sortingFn: (rowA, rowsB) => rowA.original.returnValue - rowsB.original.returnValue,
  },
  {
    accessorKey: 'strikePosition',
    header: ({ table, column }) => <DataTableColumnHeader table={table} column={column} title='Strike Position' />,
    cell: ({ row }) => (
      <span
        className={cn(
          'pr-4 font-semibold',
          row.original.strikePosition > 30 ? 'text-red-800 dark:text-red-500' : 'text-emerald-800 dark:text-emerald-500'
        )}
      >
        {row.original.strikePosition.toFixed(2)}
      </span>
    ),
    sortingFn: (rowA, rowsB) => rowA.original.strikePosition - rowsB.original.strikePosition,
  },
  {
    id: 'av',
    header: 'AV',
    cell: ({ row }) => {
      const { strikePosition, av } = row.original;
      return (
        <div
          className={cn(
            'rounded-full text-center ring-1',
            strikePosition >= av!
              ? 'bg-emerald-50/60 text-emerald-800 ring-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-500'
              : 'bg-red-50/60 text-red-800 ring-red-100 dark:bg-red-900/10 dark:text-red-500'
          )}
        >
          {row.original.av}
        </div>
      );
    },
  },
  {
    accessorKey: 'sellValue',
    header: 'Sell Value',
    cell: ({ row }) => row.original.sellValue.toFixed(2),
  },
];

export const numericCols = [
  'ltp',
  // 'peLimit',
  // 'ceLimit',
  'bid',
  'returnValue',
  'strikePrice',
  'strikePosition',
  'sellValue',
];

export const asChildCols = ['ltp', 'returnValue', 'strikePosition'];
