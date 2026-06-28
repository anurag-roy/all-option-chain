import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { useChainStatus } from '@client/hooks/use-chain-status';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: chainStatus } = useChainStatus();

  return (
    <section className='px-4'>
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Application preferences and defaults.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          <div className='flex items-center justify-between rounded-md border p-4'>
            <div>
              <p className='font-medium'>SD Multiplier</p>
              <p className='text-muted-foreground text-xs'>Current value from the active chain filter</p>
            </div>
            <span className='font-mono text-lg'>{chainStatus?.filter?.sdMultiplier ?? '—'}</span>
          </div>
          <p className='text-muted-foreground'>
            More settings (persisted defaults, symbol lists) will be added here.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
