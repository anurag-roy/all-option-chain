import type { GsecListing } from '@shared/types/gsecs';

export function gsecKey({ exchange, tradingsymbol }: Pick<GsecListing, 'exchange' | 'tradingsymbol'>): string {
  return `${exchange}:${tradingsymbol}`;
}
