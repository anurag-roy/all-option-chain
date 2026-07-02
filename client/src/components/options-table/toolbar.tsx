import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import type { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { DEFAULT_DELTA_FILTER } from './columns';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  summaryText?: string;
}

export function DataTableToolbar<TData>({ table, summaryText }: DataTableToolbarProps<TData>) {
  const searchValue = (table.getColumn('optionStrike')?.getFilterValue() as string) ?? '';
  const deltaFilterValue = (table.getColumn('delta')?.getFilterValue() as number | undefined) ?? DEFAULT_DELTA_FILTER;
  const isFiltered = Boolean(searchValue) || deltaFilterValue !== DEFAULT_DELTA_FILTER;

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    table.getColumn('optionStrike')?.setFilterValue(event.target.value);
  };

  const onDeltaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === '') {
      table.getColumn('delta')?.setFilterValue(DEFAULT_DELTA_FILTER);
      return;
    }

    const value = Number.parseFloat(raw);
    if (!Number.isNaN(value)) {
      table.getColumn('delta')?.setFilterValue(value);
    }
  };

  const resetFilters = () => {
    table.getColumn('optionStrike')?.setFilterValue('');
    table.getColumn('delta')?.setFilterValue(DEFAULT_DELTA_FILTER);
  };

  return (
    <div className='mb-4 flex items-center justify-between gap-4'>
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Search options...'
          value={searchValue}
          onChange={onSearchChange}
          className='max-w-sm'
        />
        <div className='flex items-center gap-2'>
          <Label htmlFor='deltaFilter' className='shrink-0'>
            Delta
          </Label>
          <Input
            id='deltaFilter'
            type='number'
            step='0.001'
            value={deltaFilterValue}
            onChange={onDeltaChange}
            className='w-24'
          />
        </div>
        {isFiltered ? (
          <Button variant='ghost' onClick={resetFilters} className='h-8 px-2 lg:px-3'>
            Reset
            <X className='ml-2 h-4 w-4' />
          </Button>
        ) : null}
      </div>
      {summaryText ? <p className='text-muted-foreground shrink-0 text-sm'>{summaryText}</p> : null}
    </div>
  );
}
