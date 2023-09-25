import { TotpForm } from '@/components/totp-form';
import Head from 'next/head';

export default function Login() {
  return (
    <>
      <Head>
        <title>Login - Option Chain</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="container h-full relative flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div
            className="absolute inset-0 bg-cover"
            style={{
              backgroundImage: 'url("landing.webp")',
            }}
          />
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center sm:w-[350px]">
            <h1 className="text-2xl text-center font-semibold tracking-tight">
              Your session has expired.
            </h1>
            <TotpForm />
          </div>
        </div>
      </main>
    </>
  );
}
