import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import type { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  summaryText?: string;
}

export function DataTableToolbar<TData>({ table, summaryText }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getPreFilteredRowModel().rows.length > table.getFilteredRowModel().rows.length;

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    table.getColumn('optionStrike')?.setFilterValue(event.target.value);
  };

  return (
    <div className='mb-4 flex items-center justify-between gap-4'>
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Search options...'
          value={(table.getColumn('optionStrike')?.getFilterValue() as string) ?? ''}
          onChange={onSearchChange}
          className='max-w-sm'
        />
        {isFiltered ? (
          <Button variant='ghost' onClick={() => table.resetColumnFilters()} className='h-8 px-2 lg:px-3'>
            Reset
            <X className='ml-2 h-4 w-4' />
          </Button>
        ) : null}
      </div>
      {summaryText ? <p className='text-muted-foreground shrink-0 text-sm'>{summaryText}</p> : null}
    </div>
  );
}
