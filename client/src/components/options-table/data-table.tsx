import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { cn } from '@client/lib/utils';
import type { OptionChainRow } from '@client/types/option-chain';
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { memo, useState } from 'react';
import { columns, DEFAULT_DELTA_FILTER, fillHeightCols, numericCols } from './columns';
import { DataTableToolbar } from './toolbar';

interface DataTableProps {
  data: OptionChainRow[];
  emptyMessage: string;
  summaryText?: string;
}

export const DataTable = memo(function DataTable({ data, emptyMessage, summaryText }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'returnValue', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: 'delta', value: DEFAULT_DELTA_FILTER },
  ]);

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<OptionChainRow>[],
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <>
      <DataTableToolbar table={table} summaryText={summaryText} />
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={numericCols.includes(header.column.id) ? 'text-right' : ''}>
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
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'p-0',
                        fillHeightCols.includes(cell.column.id) && 'h-px',
                        numericCols.includes(cell.column.id) ? 'text-right tabular-nums' : ''
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='text-muted-foreground h-24 text-center'>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
});
