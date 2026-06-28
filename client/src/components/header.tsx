import { NotificationCenter } from '@client/components/notification-center';
import { UserButton } from '@client/components/user-button';
import { useWebSocketContext } from '@client/contexts/websocket-context';
import { useChainStatus } from '@client/hooks/use-chain-status';
import { useUserMargin } from '@client/hooks/use-user-margin';
import { cn } from '@client/lib/utils';
import { Link } from '@tanstack/react-router';
import { TrendingUpIcon } from 'lucide-react';

function formatMargin(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1_00_00_000) {
    return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (absValue >= 1_00_000) {
    return `${(value / 1_00_000).toFixed(1)}L`;
  }
  if (absValue >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

export function Header() {
  const { isConnected } = useWebSocketContext();
  const { data: chainStatus } = useChainStatus();
  const { data: marginData } = useUserMargin();

  const sdMultiplier = chainStatus?.filter?.sdMultiplier;

  return (
    <div className='border-border bg-background sticky top-0 z-10 border-b py-4'>
      <header className='container mx-auto flex items-center justify-between px-4'>
        <div className='flex items-center gap-6'>
          <Link to='/' className='flex items-center gap-3 transition-opacity hover:opacity-80'>
            <div className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg'>
              <TrendingUpIcon className='size-5' />
            </div>
            <div>
              <h1 className='text-xl font-bold'>NSE Option Chain</h1>
              <p className='text-muted-foreground text-xs'>Zerodha Kite</p>
            </div>
          </Link>
        </div>

        <div className='flex items-center gap-4'>
          {sdMultiplier !== undefined ? (
            <Link
              to='/settings'
              className='bg-primary/10 text-primary hover:bg-primary/20 dark:bg-muted/80 dark:text-foreground dark:hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors'
            >
              <span className='text-primary/70 dark:text-foreground/70'>SD</span>
              <span>{sdMultiplier}</span>
            </Link>
          ) : null}

          {marginData?.net !== undefined ? (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                marginData.net >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400'
              )}
            >
              <span className='opacity-70'>Avl. Margin</span>
              <span>₹{formatMargin(marginData.net)}</span>
            </div>
          ) : null}

          <NotificationCenter />
          <UserButton isConnected={isConnected} />
        </div>
      </header>
    </div>
  );
}
