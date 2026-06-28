import { Button } from '@client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/components/ui/tooltip';
import { useApplyCustomBans, useBans } from '@client/hooks/use-bans';
import { useChainStatus } from '@client/hooks/use-chain-status';
import { cn } from '@client/lib/utils';
import { NSE_STOCKS_TO_INCLUDE } from '@shared/config';
import { CheckIcon, LockIcon, PencilIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

function BansTable({ stocks, type }: { stocks: string[]; type: 'nse' | 'custom' }) {
  const title = type === 'nse' ? 'NSE Bans' : 'Custom Bans';
  const emptyText = type === 'nse' ? 'No bans for today' : 'No custom bans';

  return (
    <div className='border-border h-64 w-full overflow-y-auto rounded-md border'>
      <Table className='min-w-80'>
        <TableHeader>
          <TableRow>
            <TableHead>
              {title} ({stocks.length})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.length === 0 ? (
            <TableRow>
              <TableCell className='text-muted-foreground'>{emptyText}</TableCell>
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

function BansEditDialog({ nseBans, customBans }: { nseBans: string[]; customBans: string[] }) {
  const applyCustomBans = useApplyCustomBans();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftCustomBans, setDraftCustomBans] = useState<Set<string>>(() => new Set(customBans));

  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return NSE_STOCKS_TO_INCLUDE;
    }
    return NSE_STOCKS_TO_INCLUDE.filter((symbol) => symbol.toLowerCase().includes(query));
  }, [search]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftCustomBans(new Set(customBans));
      setSearch('');
    }
    setOpen(nextOpen);
  };

  const toggleDraft = (symbol: string) => {
    setDraftCustomBans((current) => {
      const next = new Set(current);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleConfirm = () => {
    applyCustomBans.mutate(
      { desired: [...draftCustomBans], current: customBans },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('Custom bans updated');
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to update bans');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size='sm' />}>
        <PencilIcon className='mr-1 size-3' />
        Edit
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Edit custom bans</DialogTitle>
        </DialogHeader>
        <Input
          placeholder='Search...'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={applyCustomBans.isPending}
        />
        <div className='border-border max-h-72 overflow-y-auto rounded-md border'>
          {filteredStocks.length === 0 ? (
            <p className='text-muted-foreground p-4 text-sm'>No results found.</p>
          ) : (
            <ul className='divide-border divide-y'>
              {filteredStocks.map((symbol) => {
                const isNseBanned = nseBans.includes(symbol);
                const isSelected = isNseBanned || draftCustomBans.has(symbol);

                return (
                  <li key={symbol}>
                    <button
                      type='button'
                      disabled={isNseBanned || applyCustomBans.isPending}
                      onClick={() => toggleDraft(symbol)}
                      className={cn(
                        'hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                        isNseBanned && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <span
                        className={cn(
                          'border-primary flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50'
                        )}
                      >
                        {isSelected ? <CheckIcon className='size-3' /> : null}
                      </span>
                      <span className='flex-1'>{symbol}</span>
                      {isNseBanned ? <LockIcon className='text-muted-foreground size-4' /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={handleCancel} disabled={applyCustomBans.isPending}>
            Cancel
          </Button>
          <Button type='button' onClick={handleConfirm} disabled={applyCustomBans.isPending}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BansManagement() {
  const { data, isLoading, isError } = useBans();
  const { data: chainStatus } = useChainStatus();

  const nseBans = data?.bans.filter((ban) => ban.type === 'nse').map((ban) => ban.name) ?? [];
  const customBans = data?.bans.filter((ban) => ban.type === 'custom').map((ban) => ban.name) ?? [];
  const chainReady = chainStatus?.status === 'ready';

  if (isLoading) {
    return <p className='text-muted-foreground text-sm'>Loading banned stocks...</p>;
  }

  if (isError) {
    return <p className='text-destructive text-sm'>Failed to load banned stocks.</p>;
  }

  return (
    <section className='w-full'>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Banned Stocks</h2>
          <p className='text-muted-foreground text-sm'>
            NSE F&amp;O bans refresh daily. Custom bans persist until removed.
          </p>
        </div>
        {chainReady ? (
          <Tooltip>
            <TooltipTrigger render={<span className='inline-flex cursor-help' />}>
              <LockIcon className='text-muted-foreground size-4' />
            </TooltipTrigger>
            <TooltipContent>
              <p>Cannot update banned stocks after subscribing.</p>
              <p>Reload to edit.</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <BansEditDialog nseBans={nseBans} customBans={customBans} />
        )}
      </div>
      <div className='border-border grid w-full grid-cols-1 gap-4 rounded-md border p-4 lg:grid-cols-2'>
        <BansTable stocks={nseBans} type='nse' />
        <BansTable stocks={customBans} type='custom' />
      </div>
    </section>
  );
}
