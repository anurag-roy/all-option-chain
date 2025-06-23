import { cn } from '@/lib/utils';
import { UiInstrument } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DataTableColumnHeader } from './column-header';
import { RowOrderAction } from './order-action';
import { useStockStore } from '@/stores/stocks';

const green = 'bg-emerald-50/60 text-emerald-800 ring-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-500';
const red = 'bg-red-50/60 text-red-800 ring-red-100 dark:bg-red-900/10 dark:text-red-500';

// Create columns as a function that takes the SD multiplier
export const createColumns = (sdMultiplier: number): ColumnDef<UiInstrument>[] => [
  {
    id: 'optionStrike',
    header: 'Option Strike',
    cell: ({ row }) => {
      const { symbol, strikePrice, optionType } = row.original;
      return (
        <div className='p-2 pl-4'>
          {symbol} {strikePrice} {optionType}
        </div>
      );
    },
  },
  {
    header: 'Stock',
    cell: ({ row }) => {
      const { symbol } = row.original;
      return <div className='p-2'>{symbol}</div>;
    },
  },
  {
    accessorKey: 'ltp',
    header: 'LTP',
    cell: ({ row }) => {
      const ltp = row.original.ltp;
      return <div className={cn('p-2 font-semibold', ltp > 0 ? green : red)}>{row.original.ltp.toFixed(2)}</div>;
    },
  },
  {
    id: 'dv',
    header: 'DV',
    cell: ({ row }) => {
      const dv = row.original.dv;
      let text = 'text-yellow-800 dark:text-yellow-500';
      const ltpChangePercent = row.original.gainLossPercent;
      if (dv && ltpChangePercent) {
        const [min, max] = [dv, dv * -1].sort((a, b) => a - b);
        if (ltpChangePercent >= min && ltpChangePercent <= max) {
          text = 'text-emerald-800 dark:text-emerald-500';
        } else {
          text = 'text-red-800 dark:text-red-500';
        }
      }
      return (
        <div className={cn('bg-yellow-50/60 p-2 text-center dark:bg-yellow-900/20', text)}>
          {row.original.dv?.toFixed(2)}
        </div>
      );
    },
  },
  {
    header: 'Strike',
    cell: ({ row }) => (
      <div className='p-2'>
        {row.original.strikePrice} {row.original.optionType}
      </div>
    ),
  },
  {
    accessorKey: 'bid',
    header: 'Buyer Price',
    cell: ({ row }) => <div className='p-2'>{row.original.bid.toFixed(2)}</div>,
  },
  {
    accessorKey: 'returnValue',
    header: ({ table, column }) => <DataTableColumnHeader table={table} column={column} title='Return Value' />,
    cell: ({ row }) => (
      <div className={cn('font-semibold', row.original.returnValue > 0 ? green : red)}>
        <RowOrderAction row={row} />
      </div>
    ),
    sortingFn: (rowA, rowsB) => rowA.original.returnValue - rowsB.original.returnValue,
  },
  {
    accessorKey: 'strikePosition',
    header: ({ table, column }) => <DataTableColumnHeader table={table} column={column} title='Strike Position' />,
    cell: ({ row }) => (
      <div
        className={cn(
          'p-1 pr-4 font-semibold',
          row.original.strikePositionChange && row.original.strikePositionChange > 0 ? green : red,
          row.original.strikePosition > 30 ? 'text-red-800 dark:text-red-500' : 'text-emerald-800 dark:text-emerald-500'
        )}
      >
        <span className='rounded-full px-2 py-1 ring-1 ring-gray-400 dark:ring-gray-100'>
          {row.original.strikePosition.toFixed(2)}
        </span>
      </div>
    ),
    sortingFn: (rowA, rowsB) => rowA.original.strikePosition - rowsB.original.strikePosition,
  },
  {
    id: 'sigmaN',
    header: 'σₙ %',
    cell: ({ row }) => {
      const { sigmaN } = row.original;
      if (!sigmaN || sigmaN <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      return (
        <div className='bg-blue-50/60 p-2 text-center text-blue-800 dark:bg-blue-900/20 dark:text-blue-500'>
          {sigmaN.toFixed(3)}%
        </div>
      );
    },
  },
  {
    id: 'sigmaX',
    header: 'σₓ %',
    cell: ({ row }) => {
      const { sigmaX } = row.original;
      if (!sigmaX || sigmaX <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      return (
        <div className='bg-purple-50/60 p-2 text-center text-purple-800 dark:bg-purple-900/20 dark:text-purple-500'>
          {sigmaX.toFixed(3)}%
        </div>
      );
    },
  },
  {
    id: 'sigmaXI',
    header: 'σₓᵢ %',
    cell: ({ row }) => {
      const { sigmaXI } = row.original;
      if (!sigmaXI || sigmaXI <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      return (
        <div className='bg-indigo-50/60 p-2 text-center text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-500'>
          {sigmaXI.toFixed(3)}%
        </div>
      );
    },
  },
  {
    id: 'sigmaXIBound',
    header: 'σₓᵢ Bound',
    cell: ({ row }) => {
      const { ltp, sigmaXI, optionType } = row.original;
      if (!sigmaXI || sigmaXI <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }

      let bound: number;
      let colorClass: string;

      if (optionType === 'CE') {
        // For calls: ceiling bound
        bound = ltp + (ltp * sigmaXI) / 100;
        colorClass = 'bg-green-50/60 text-green-800 dark:bg-green-900/20 dark:text-green-500';
      } else {
        // For puts: floor bound
        bound = ltp - (ltp * sigmaXI) / 100;
        colorClass = 'bg-red-50/60 text-red-800 dark:bg-red-900/20 dark:text-red-500';
      }

      return <div className={cn('p-2 text-center', colorClass)}>{bound.toFixed(2)}</div>;
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
  'minusAV',
  'plusAV',
  'sigmaN',
  'sigmaX',
  'sigmaXI',
  'sigmaXIBound',
];

export const getNumericCols = (sdMultiplier: number) => [
  'ltp',
  'bid',
  'returnValue',
  'strikePrice',
  'strikePosition',
  'sellValue',
  'minusAV',
  'plusAV',
  'sigmaN',
  'sigmaX',
  'sigmaXI',
  'sigmaXIBound',
];

export const asChildCols = ['ltp', 'returnValue', 'strikePosition'];

// Hook to get columns with current SD multiplier
export const useColumns = (): ColumnDef<UiInstrument>[] => {
  const sdMultiplier = useStockStore((state) => state.sdMultiplier);
  return useMemo(() => createColumns(sdMultiplier), [sdMultiplier]);
};

// Hook to get numeric columns with current SD multiplier
export const useNumericCols = (): string[] => {
  const sdMultiplier = useStockStore((state) => state.sdMultiplier);
  return useMemo(() => getNumericCols(sdMultiplier), [sdMultiplier]);
};
