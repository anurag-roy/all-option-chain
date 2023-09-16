import { ModeToggle } from '@/components/mode-toggle';
import { OptionsTable } from '@/components/options-table';
import { SubscriptionForm } from '@/components/subscription-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';

export async function getServerSideProps() {
  await injectTokenIntoEnv();

  if (!process.env.token) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: {
      token: process.env.token,
    },
  };
}

export default function Home() {
  return (
    <>
      <header>
        <ModeToggle />
      </header>
      <main>
        <SubscriptionForm />
        <OptionsTable />
      </main>
    </>
  );
}
