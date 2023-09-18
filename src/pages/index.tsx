import { Header } from '@/components/header';
import { OptionsTable } from '@/components/options-table';
import { SubscriptionForm } from '@/components/subscription-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';
import { useInstrumentStore } from '@/stores/instruments';
import * as React from 'react';

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

type HomeProps = {
  token: string;
};

export default function Home({ token }: HomeProps) {
  const setToken = useInstrumentStore((state) => state.setToken);
  const initSocket = useInstrumentStore((state) => state.initSocket);

  React.useEffect(() => {
    setToken(token);
    initSocket();
  }, []);

  return (
    <>
      <Header />
      <main className="py-6">
        <SubscriptionForm />
        <OptionsTable />
      </main>
    </>
  );
}
