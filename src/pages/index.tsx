import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
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
      <ModeToggle />
      <Button>Hello</Button>
    </>
  );
}
