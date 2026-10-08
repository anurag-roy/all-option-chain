import type { GsecListing } from '@shared/types/gsecs';

export function GsecName({ listing }: { listing: Pick<GsecListing, 'exchange' | 'tradingsymbol'> }) {
  return (
    <span className='inline-flex items-center gap-2 whitespace-nowrap'>
      {listing.exchange === 'BSE' ? (
        <span className='size-1.5 shrink-0 rounded-full bg-black dark:bg-white' aria-hidden='true' />
      ) : null}
      {listing.tradingsymbol}
    </span>
  );
}
