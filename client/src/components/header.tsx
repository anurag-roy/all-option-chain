import { api } from '@client/lib/api';
import { useEffect, useState } from 'react';

export function Header() {
  const [userName, setUserName] = useState<string>('Loading...');
  const [netMargin, setNetMargin] = useState<number | null>(null);

  useEffect(() => {
    api.user
      .$get()
      .then(async (response: Response) => {
        if (response.ok) {
          const data = await response.json();
          setUserName(data.user_name ?? data.user_id ?? 'User');
        } else {
          setUserName('Not logged in');
        }
      })
      .catch(() => setUserName('Not logged in'));

    api.user.margin
      .$get()
      .then(async (response: Response) => {
        if (response.ok) {
          const data = await response.json();
          setNetMargin(data.net ?? null);
        }
      })
      .catch(() => setNetMargin(null));
  }, []);

  return (
    <header className='border-border bg-card/50 border-b'>
      <div className='mx-auto flex max-w-384 items-center justify-between px-4 py-4'>
        <div>
          <h1 className='text-xl font-bold'>Option Chain</h1>
          <p className='text-muted-foreground text-sm'>NSE F&O via Zerodha Kite</p>
        </div>
        <div className='text-right text-sm'>
          <p className='font-medium'>{userName}</p>
          {netMargin !== null ? (
            <p className='text-muted-foreground'>Net margin: ₹{netMargin.toLocaleString('en-IN')}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
