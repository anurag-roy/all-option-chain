import { useWebSocketContext } from '@client/contexts/websocket-context';
import { Loader2 } from 'lucide-react';

export function StatusBanner() {
  const { chainStatus, statusMessage, isConnected, rowCount, visibleRowCount } = useWebSocketContext();

  if (chainStatus === 'idle' && isConnected && rowCount === 0) {
    return null;
  }

  return (
    <div className='bg-muted/60 text-muted-foreground border-b px-4 py-2 text-sm'>
      <div className='mx-auto flex max-w-384 items-center gap-2'>
        {['warming', 'fetching_quotes', 'subscribing'].includes(chainStatus) ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : null}
        <span>
          Status: {chainStatus}
          {statusMessage ? ` — ${statusMessage}` : ''}
          {rowCount > 0 ? ` — ${rowCount} loaded, ${visibleRowCount} match entry value` : ''}
          {!isConnected ? ' (websocket disconnected)' : ''}
        </span>
      </div>
    </div>
  );
}
