import { BansManagement } from '@client/components/bans-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <section className='w-full px-4'>
      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage banned stocks and application preferences.</CardDescription>
        </CardHeader>
        <CardContent className='w-full'>
          <BansManagement />
        </CardContent>
      </Card>
    </section>
  );
}
