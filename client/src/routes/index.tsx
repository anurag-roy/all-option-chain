import { ChainFilterForm } from '@client/components/chain-filter-form';
import { OptionsTable } from '@client/components/options-table';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <section>
        <div className='border-border bg-card rounded-md border'>
          <ChainFilterForm />
          <OptionsTable />
        </div>
      </section>
    </>
  );
}
