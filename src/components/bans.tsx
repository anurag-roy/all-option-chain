import { NSE_STOCKS_TO_INCLUDE } from '@/config';
import { cn, getTodayAsParam } from '@/lib/utils';
import { useBansStore } from '@/stores/bans';
import { useStockStore } from '@/stores/stocks';
import { BannedStock } from '@/types';
import { CheckIcon, LockClosedIcon, Pencil1Icon } from '@radix-ui/react-icons';
import ky from 'ky';
import * as React from 'react';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

function BansTable({ stocks, type }: { stocks: string[]; type: 'nse' | 'custom' }) {
  const title = type === 'nse' ? 'NSE Bans' : 'Custom Bans';
  const emptyText = type === 'nse' ? 'No bans for today' : 'No custom bans';

  return (
    <div className='ml-auto h-56 w-full overflow-y-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {title} ({stocks.length})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className='[&_tr:last-child]:border-1'>
          {stocks.length === 0 ? (
            <TableRow className='border-0'>
              <TableCell>{emptyText}</TableCell>
            </TableRow>
          ) : (
            stocks.map((stock) => (
              <TableRow key={stock}>
                <TableCell>{stock}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const LS_KEY_BANS = 'bans';
export function Bans() {
  const initComplete = useStockStore((state) => state.initComplete);
  const { bannedStocks, setBannedStocks, toggleBannedStock } = useBansStore();
  const nseBans = bannedStocks.filter((s) => s.type === 'nse').map((s) => s.name);
  const customBans = bannedStocks.filter((s) => s.type === 'custom').map((s) => s.name);
  const dateParam = React.useRef(getTodayAsParam()).current;

  React.useEffect(() => {
    const bansFromLs = localStorage.getItem(LS_KEY_BANS);

    if (bansFromLs) {
      const bannedStocks = JSON.parse(bansFromLs);
      if (dateParam in bannedStocks) {
        setBannedStocks(bannedStocks[dateParam]);
        return;
      }
    }

    ky.get('/api/bans', {
      searchParams: {
        dateParam,
      },
    })
      .json<string[]>()
      .then((bans) => {
        const mappedBans: BannedStock[] = bans.map((b) => ({ name: b, type: 'nse' }));
        setBannedStocks(mappedBans);
      })
      .catch();
  }, []);

  React.useEffect(() => {
    const bannedStocksForLs = {
      [dateParam]: bannedStocks,
    };
    localStorage.setItem(LS_KEY_BANS, JSON.stringify(bannedStocksForLs));
  }, [bannedStocks]);

  return (
    <section>
      <div className='flex items-center justify-between'>
        <h2 className='mb-2 ml-1 text-xl font-bold'>Bans</h2>
        {initComplete ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <LockClosedIcon className='h-4 w-4' />
              </TooltipTrigger>
              <TooltipContent>
                <p>Cannot update banned stocks after subscribing.</p>
                <p>Please reload the page and try again.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button size='sm' variant='ghost'>
                <Pencil1Icon className='mr-1 h-3 w-3' />
                Edit
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[250px] p-0' align='center'>
              <Command>
                <CommandInput placeholder='Search...' />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {NSE_STOCKS_TO_INCLUDE.map((s) => {
                      const isDisabled = nseBans.includes(s);
                      const isSelected = isDisabled || customBans.includes(s);
                      return (
                        <CommandItem key={s} disabled={isDisabled} onSelect={() => toggleBannedStock(s)}>
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                              isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'
                            )}
                          >
                            <CheckIcon className={cn('h-4 w-4')} />
                          </div>
                          {s}
                          {isDisabled ? <LockClosedIcon className='ml-auto h-4 w-4' /> : ''}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className='grid grid-cols-2 gap-4 rounded-md border p-4'>
        <BansTable stocks={nseBans} type='nse' />
        <BansTable stocks={customBans} type='custom' />
      </div>
    </section>
  );
}
