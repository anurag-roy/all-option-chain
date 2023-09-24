import { AmoOrderForm } from '@/components/amo-order-form';
import { injectTokenIntoEnv } from '@/lib/api/utils';
import { getAllEquityStocks } from '@/lib/db';
import type { instrument } from '@prisma/client';

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

  return {
    props: {
      equityStocks,
    },
  };
}

type AmoProps = {
  equityStocks: instrument[];
};

export default function Home({ equityStocks }: AmoProps) {
  return (
    <main className="max-w-7xl mx-auto py-6">
      <AmoOrderForm equityStocks={equityStocks} />
    </main>
  );
}
