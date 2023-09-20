import { Bans } from '@/components/bans';
import { Header } from '@/components/header';
import { Movers } from '@/components/movers';
import { OptionsTable } from '@/components/options-table';
import { SubscriptionForm } from '@/components/subscription-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';
import { useStockStore } from '@/stores/stocks';
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
  const setToken = useStockStore((state) => state.setToken);
  // const initSocket = useStockStore((state) => state.initSocket);

  React.useEffect(() => {
    setToken(token);
    // initSocket();
  }, []);

  return (
    <>
      <Header />
      <main className="py-6">
        <div className="flex">
          <Movers />
          <Bans />
        </div>
        <SubscriptionForm />
        <OptionsTable />
      </main>
    </>
  );
}
