import { Bans } from '@/components/bans';
import { Header } from '@/components/header';
import { Movers } from '@/components/movers';
import { OptionsTable } from '@/components/options-table';
import { SubscriptionForm } from '@/components/subscription-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';
import { useStockStore } from '@/stores/stocks';
import Head from 'next/head';
import * as React from 'react';

export async function getServerSideProps() {
  await injectTokenIntoEnv();

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
      <Head>
        <title>Home - Option Chain</title>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <Header />
      <main className='mx-auto max-w-7xl space-y-8 py-6'>
        <div className='grid grid-cols-[6fr_4fr] gap-8'>
          <Movers />
          <Bans />
        </div>
        <section>
          <h2 className='mb-2 ml-1 text-xl font-bold'>Option Chain</h2>
          <div className='rounded-md border'>
            <SubscriptionForm />
            <OptionsTable />
          </div>
        </section>
      </main>
    </>
  );
}
