import { Header } from '@client/components/header';
import { StatusBanner } from '@client/components/status-banner';
import { Toaster } from '@client/components/ui/sonner';
import { TooltipProvider } from '@client/components/ui/tooltip';
import { NotificationProvider } from '@client/contexts/notification-context';
import { WebSocketProvider } from '@client/contexts/websocket-context';
import { useTheme } from '@client/hooks/use-theme';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import '../index.css';

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <TooltipProvider>
      <NotificationProvider>
        <WebSocketProvider>
          <RootLayout />
        </WebSocketProvider>
      </NotificationProvider>
    </TooltipProvider>
  );
}

function RootLayout() {
  const { theme } = useTheme();

  return (
    <>
      <div className='dark:bg-background flex min-h-screen flex-col bg-zinc-50'>
        <Header />
        <StatusBanner />
        <main className='mx-auto max-w-384 space-y-8 py-6'>
          <Outlet />
        </main>
      </div>
      <Toaster richColors theme={theme} />
    </>
  );
}
