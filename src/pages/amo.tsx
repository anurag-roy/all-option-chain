import { AmoOrderForm } from '@/components/amo-order-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';
import { getAllEquityStocks } from '@/lib/db';
import Head from 'next/head';

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

  const equityStocks = await getAllEquityStocks();
  const equityStockOptions = equityStocks.map((stock) => stock.tradingSymbol);
  return {
    props: {
      equityStockOptions,
    },
  };
}

type AmoProps = {
  equityStockOptions: string[];
};

export default function Home({ equityStockOptions }: AmoProps) {
  return (
    <>
      <Head>
        <title>AMO - Option Chain</title>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <main className='mx-auto max-w-7xl py-6'>
        <AmoOrderForm equityStockOptions={equityStockOptions} />
      </main>
    </>
  );
}
