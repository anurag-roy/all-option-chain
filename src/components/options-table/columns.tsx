import { cn } from '@/lib/utils';
import { UiInstrument } from '@/types';
import { ColumnDef } from '@tanstack/react-table';
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
    id: 'minusSD1',
    header: '-SD1',
    cell: ({ row }) => {
      const { ltp, sd } = row.original;
      if (!sd || sd <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      const minusSD1 = (ltp * (100 - sd)) / 100;
      return (
        <div className='bg-red-50/60 p-2 text-center text-red-800 dark:bg-red-900/20 dark:text-red-500'>
          {minusSD1.toFixed(2)}
        </div>
      );
    },
  },
  {
    id: 'plusSD1',
    header: '+SD1',
    cell: ({ row }) => {
      const { ltp, sd } = row.original;
      if (!sd || sd <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      const plusSD1 = (ltp * (100 + sd)) / 100;
      return (
        <div className='bg-green-50/60 p-2 text-center text-green-800 dark:bg-green-900/20 dark:text-green-500'>
          {plusSD1.toFixed(2)}
        </div>
      );
    },
  },
  {
    id: 'minusSDMultiplier',
    header: `-${sdMultiplier}SD`,
    cell: ({ row }) => {
      const { ltp, sd } = row.original;
      if (!sd || sd <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      const minusSD = (ltp * (100 - sd * sdMultiplier)) / 100;
      return (
        <div className='bg-red-50/60 p-2 text-center text-red-800 dark:bg-red-900/20 dark:text-red-500'>
          {minusSD.toFixed(2)}
        </div>
      );
    },
  },
  {
    id: 'plusSDMultiplier',
    header: `+${sdMultiplier}SD`,
    cell: ({ row }) => {
      const { ltp, sd } = row.original;
      if (!sd || sd <= 0) {
        return (
          <div className='bg-gray-50/60 p-2 text-center text-gray-500 dark:bg-gray-900/20 dark:text-gray-400'>N/A</div>
        );
      }
      const plusSD = (ltp * (100 + sd * sdMultiplier)) / 100;
      return (
        <div className='bg-green-50/60 p-2 text-center text-green-800 dark:bg-green-900/20 dark:text-green-500'>
          {plusSD.toFixed(2)}
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
  'minusAV',
  'plusAV',
  'minusSD1',
  'plusSD1',
  'minusSDMultiplier',
  'plusSDMultiplier',
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
  'minusSD1',
  'plusSD1',
  'minusSDMultiplier',
  'plusSDMultiplier',
];

export const asChildCols = ['ltp', 'returnValue', 'strikePosition'];

// Hook to get columns with current SD multiplier
export const useColumns = (): ColumnDef<UiInstrument>[] => {
  const sdMultiplier = useStockStore((state) => state.sdMultiplier);
  return createColumns(sdMultiplier);
};

// Hook to get numeric columns with current SD multiplier
export const useNumericCols = (): string[] => {
  const sdMultiplier = useStockStore((state) => state.sdMultiplier);
  return getNumericCols(sdMultiplier);
};
