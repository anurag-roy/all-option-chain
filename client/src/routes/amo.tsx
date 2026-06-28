import { AmoOrderForm } from '@client/components/amo-order-form';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/amo')({
  component: AmoPage,
});

function AmoPage() {
  return (
    <section className='px-4'>
      <AmoOrderForm />
    </section>
  );
}
