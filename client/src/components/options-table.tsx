import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/components/ui/table';
import { useWebSocketContext } from '@client/contexts/websocket-context';
import { cn, displayInr } from '@client/lib/utils';
import type { OptionChainRow } from '@client/types/option-chain';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

const columnHelper = createColumnHelper<OptionChainRow>();

const positiveClass = 'text-emerald-700 dark:text-emerald-400';
const negativeClass = 'text-red-700 dark:text-red-400';

export function OptionsTable() {
  const { optionChainData, entryValue, rowCount } = useWebSocketContext();

  const allRows = useMemo(() => Object.values(optionChainData), [optionChainData]);

  const data = useMemo(
    () =>
      allRows
        .filter((row) => row.sellValue >= entryValue)
        .sort((a, b) => b.returnValue - a.returnValue),
    [allRows, entryValue]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Stock' }),
      columnHelper.accessor((row) => `${row.strike} ${row.instrumentType}`, {
        id: 'strike',
        header: 'Strike',
      }),
      columnHelper.accessor('underlyingLtp', {
        header: 'LTP',
        cell: (info) => (
          <span className={cn('font-semibold', info.getValue() > 0 ? positiveClass : negativeClass)}>
            {info.getValue().toFixed(2)}
          </span>
        ),
      }),
      columnHelper.accessor('bid', {
        header: 'Bid',
        cell: (info) => info.getValue().toFixed(2),
      }),
      columnHelper.accessor('sellValue', {
        header: 'Sell Value',
        cell: (info) => displayInr(info.getValue()),
      }),
      columnHelper.accessor('returnValue', {
        header: 'Return %',
        cell: (info) => (
          <span className={cn('font-semibold', info.getValue() > 0 ? positiveClass : negativeClass)}>
            {info.getValue().toFixed(2)}
          </span>
        ),
      }),
      columnHelper.accessor('strikePosition', {
        header: 'Strike Pos',
        cell: (info) => info.getValue().toFixed(2),
      }),
      columnHelper.accessor('delta', {
        header: 'Delta',
        cell: (info) => (info.getValue() * 100).toFixed(4),
      }),
      columnHelper.accessor('oi', {
        header: 'OI',
        cell: (info) => info.getValue().toLocaleString('en-IN'),
      }),
      columnHelper.accessor('marginStatus', {
        header: 'Margin',
        cell: (info) => info.getValue(),
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const emptyMessage = useMemo(() => {
    if (allRows.length === 0 && rowCount === 0) {
      return 'Apply a filter to load the option chain.';
    }
    if (allRows.length === 0 && rowCount > 0) {
      return 'Server loaded instruments but no data reached the client yet. Try reapplying the filter.';
    }
    if (data.length === 0) {
      return `${allRows.length} instruments loaded, but none have sell value ≥ entry value (${entryValue}). On market holidays bids are often 0 — try lowering entry value to 0.`;
    }
    return '';
  }, [allRows.length, data.length, entryValue, rowCount]);

  return (
    <div className="border-t p-4">
      {allRows.length > 0 ? (
        <p className="text-muted-foreground mb-3 text-sm">
          Showing {data.length} of {allRows.length} instruments (entry value ≥ {entryValue})
        </p>
      ) : null}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
