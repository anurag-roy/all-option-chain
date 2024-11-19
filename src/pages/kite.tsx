import env from '@/env.json';
import * as React from 'react';

export default function PlaceOrderKite() {
  const [data, setData] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const urlSearchString = window.location.search;
    const params = new URLSearchParams(urlSearchString);
    setData(params.get('data'));
  }, []);

  React.useEffect(() => {
    if (data) {
      formRef.current?.submit();
    }
  }, [data]);

  if (!data) {
    return null; // or a loading state
  }

  return (
    <form method='post' action='https://kite.zerodha.com/connect/basket' target='_self' ref={formRef}>
      <input type='hidden' name='api_key' value={env.KITE_PUBLISHER_API_KEY} />
      <input type='hidden' name='data' value={data} />
    </form>
  );
}
