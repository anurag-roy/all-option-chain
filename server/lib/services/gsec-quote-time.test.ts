import { describe, expect, it } from 'vitest';
import { gsecExchangeQuoteTime, gsecRestExchangeQuoteTime } from './gsec-quote-time';

describe('exchange quote times', () => {
  it('interprets REST text and SDK local-clock Dates as IST, and preserves websocket epoch Dates', () => {
    const expected = '2026-10-13T03:48:42.000Z';
    expect(gsecRestExchangeQuoteTime('2026-10-13 09:18:42')).toBe(expected);
    expect(gsecRestExchangeQuoteTime(new Date(2026, 9, 13, 9, 18, 42))).toBe(expected);
    expect(gsecExchangeQuoteTime(new Date(expected))).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'invalid',
    '2026-02-30 09:18:42',
    '2026-10-13 24:00:00',
    '2026-10-13 09:60:00',
    new Date(NaN),
    new Date(0),
  ])('rejects invalid exchange time %s', (time) => {
    expect(gsecExchangeQuoteTime(time)).toBeNull();
  });
});
