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
    accessorFn: (row) => (0.7 * row.ltp).toFixed(2),
  },
  {
    id: 'ceLimit',
    header: 'CE Limit',
    accessorFn: (row) => (1.3 * row.ltp).toFixed(2),
  },
  {
    accessorKey: 'bid',
    header: 'Buyer Price',
    cell: ({ row }) => row.original.bid.toFixed(2),
  },
  {
    accessorKey: 'returnValue',
    header: ({ table, column }) => (
      <DataTableColumnHeader
        table={table}
        column={column}
        title="Return Value"
      />
    ),
    cell: ({ row }) => <RowOrderAction row={row} />,
    sortingFn: (rowA, rowsB) =>
      rowA.original.returnValue - rowsB.original.returnValue,
  },
  {
    accessorKey: 'strikePosition',
    header: ({ table, column }) => (
      <DataTableColumnHeader
        table={table}
        column={column}
        title="Strike Position"
      />
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
