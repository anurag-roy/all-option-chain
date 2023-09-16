import { UiInstrument } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from './column-header';

export const columns: ColumnDef<UiInstrument>[] = [
  {
    accessorKey: 'tradingSymbol',
    header: 'Option Strike',
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
    id: 'ltp',
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
    accessorKey: 'return',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Return Value" />
    ),
    cell: ({ row }) => row.original.return.toFixed(2),
    sortingFn: (rowA, rowsB) =>
      rowA.getValue<number>('return') - rowsB.getValue<number>('return'),
  },
  {
    id: 'strikePosition',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Strike Position" />
    ),
    cell: ({ row }) => {
      const { strikePrice, ltp } = row.original;
      const position = Math.abs(strikePrice - ltp).toFixed(2);
      return position;
    },
    sortingFn: (rowA, rowsB) => {
      const { strikePrice: strikePriceA, ltp: ltpA } = rowA.original;
      const { strikePrice: strikePriceB, ltp: ltpB } = rowsB.original;
      const positionA = Math.abs(strikePriceA - ltpA);
      const positionB = Math.abs(strikePriceB - ltpB);
      return positionA - positionB;
    },
  },
  {
    accessorKey: 'value',
    header: 'Sell Value',
    cell: ({ row }) => row.original.value.toFixed(2),
  },
];

export const numericCols = [
  'strikePrice',
  'ltp',
  'peLimit',
  'ceLimit',
  'bid',
  'return',
  'strikePosition',
  'value',
];
