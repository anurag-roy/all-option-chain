import { ChainFilterForm } from '@client/components/chain-filter-form';
import { Header } from '@client/components/header';
import { OptionsTable } from '@client/components/options-table';
import { WebSocketProvider, useWebSocketContext } from '@client/contexts/websocket-context';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

function StatusBanner() {
  const { chainStatus, statusMessage, isConnected, rowCount, visibleRowCount } = useWebSocketContext();

  if (chainStatus === 'idle' && isConnected && rowCount === 0) {
    return null;
  }

  return (
    <div className="bg-muted/60 text-muted-foreground border-b px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        {['warming', 'fetching_quotes', 'subscribing'].includes(chainStatus) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
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

function AppContent() {
  return (
    <>
      <Header />
      <StatusBanner />
      <main className="mx-auto max-w-7xl space-y-8 py-6">
        <section>
          <h2 className="mb-2 ml-1 text-xl font-bold">Option Chain</h2>
          <div className="border-border bg-card rounded-md border">
            <ChainFilterForm />
            <OptionsTable />
          </div>
        </section>
      </main>
    </>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppContent />
      <Toaster richColors position="top-right" />
    </WebSocketProvider>
  );
}
