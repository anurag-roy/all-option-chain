import { cn } from '@/lib/utils';
import { UiInstrument } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from './column-header';

export const columns: ColumnDef<UiInstrument>[] = [
  {
    id: 'optionStrike',
    header: 'Option Strike',
    cell: ({ row }) =>
      `${row.original.symbol} ${row.original.strikePrice}${row.original.optionType}`,
  },
  {
    accessorKey: 'strikePrice',
    header: 'Strike',
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
    id: 'peLimit',
    header: 'PE Limit',
    cell: ({ row }) => (0.7 * row.original.ltp).toFixed(2),
  },
  {
    id: 'ceLimit',
    header: 'CE Limit',
    cell: ({ row }) => (1.3 * row.original.ltp).toFixed(2),
  },
  {
    accessorKey: 'bid',
    header: 'Buyer Price',
    cell: ({ row }) => row.original.bid.toFixed(2),
  },
  {
    accessorKey: 'returnValue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Return Value" />
    ),
    cell: ({ row }) => (
      <span className="pr-4">{row.original.returnValue.toFixed(2)}</span>
    ),
    sortingFn: (rowA, rowsB) =>
      rowA.original.returnValue - rowsB.original.returnValue,
  },
  {
    accessorKey: 'strikePosition',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Strike Position" />
    ),
    cell: ({ row }) => (
      <span
        className={cn(
          'pr-4 font-semibold',
          row.original.strikePosition > 30
            ? 'text-red-800 dark:text-red-400'
            : 'text-emerald-800 dark:text-emerald-400'
        )}
      >
        {row.original.strikePosition.toFixed(2)}
      </span>
    ),
    sortingFn: (rowA, rowsB) =>
      rowA.original.strikePosition - rowsB.original.strikePosition,
  },
  {
    accessorKey: 'sellValue',
    header: 'Sell Value',
    cell: ({ row }) => row.original.sellValue.toFixed(2),
  },
];

export const numericCols = [
  'ltp',
  'peLimit',
  'ceLimit',
  'bid',
  'returnValue',
  'strikePosition',
  'sellValue',
];
