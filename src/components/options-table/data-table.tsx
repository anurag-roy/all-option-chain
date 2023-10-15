import { cn } from '@/lib/utils';
import { UiInstrument } from '@/types';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { asChildCols, numericCols } from './columns';
import { DataTablePagination } from './pagination';
import { DataTableToolbar } from './toolbar';

interface DataTableProps {
  columns: ColumnDef<UiInstrument>[];
  data: UiInstrument[];
}

export function DataTable({ columns, data }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  return (
    <>
      <DataTableToolbar table={table} />
      <div className='mb-4 rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={numericCols.includes(header.getContext().column.id) ? 'text-right' : ''}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => {
                    const columnId = cell.getContext().column.id;
                    let overrideCellBg = '';
                    if (asChildCols.includes(columnId)) {
                      overrideCellBg = 'font-semibold';
                      const value = row.original[`${columnId as 'ltp' | 'returnValue' | 'strikePosition'}Change`];
                      if (value) {
                        if (value > 0)
                          overrideCellBg +=
                            ' bg-emerald-50/60 text-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-500';
                        else overrideCellBg += ' bg-red-50/60 text-red-800 dark:bg-red-900/10 dark:text-red-500';
                      }
                    }
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          numericCols.includes(cell.getContext().column.id) ? 'text-right tabular-nums' : '',
                          overrideCellBg
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </>
  );
}
