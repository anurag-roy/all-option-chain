import { ModeToggle } from '@/components/mode-toggle';
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
    props: {},
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
      </main>
    </>
  );
}
