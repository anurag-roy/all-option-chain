import { Button } from '@client/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/components/ui/dropdown-menu';
import { cn } from '@client/lib/utils';
import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw } from 'lucide-react';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant='ghost' size='sm' className='data-[state=open]:bg-accent ml-auto h-8'>
              <span>{title}</span>
              {column.getIsSorted() === 'desc' ? (
                <ArrowDown className='ml-2 h-4 w-4' />
              ) : column.getIsSorted() === 'asc' ? (
                <ArrowUp className='ml-2 h-4 w-4' />
              ) : (
                <ChevronsUpDown className='ml-2 h-4 w-4' />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align='start'>
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className='text-muted-foreground mr-2 h-3.5 w-3.5' />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className='text-muted-foreground mr-2 h-3.5 w-3.5' />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.clearSorting()}>
            <RotateCcw className='text-muted-foreground mr-2 h-3.5 w-3.5' />
            Reset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
