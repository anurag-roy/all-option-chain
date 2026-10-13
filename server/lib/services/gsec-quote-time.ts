import { parseBondDate } from '@server/lib/calculators/gsec-cash-flows';

/** REST quote strings are exchange-local IST; full-mode ticks supply a Date. */
export function gsecExchangeQuoteTime(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(+value) && +value > 0 ? value.toISOString() : null;
  if (typeof value !== 'string') return null;
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!local || !parseBondDate(local[1]!) || Number(local[2]) > 23 || Number(local[3]) > 59 || Number(local[4]) > 59)
    return null;
  return new Date(`${local[1]}T${local[2]}:${local[3]}:${local[4]}+05:30`).toISOString();
}

/** kiteconnect-ts parses unzoned REST timestamps with new Date (host timezone).
 * Recover its local clock fields before interpreting them as exchange-local IST.
 * This conversion must not be used on epoch-based websocket timestamps.
 */
export function gsecRestExchangeQuoteTime(value: unknown): string | null {
  if (!(value instanceof Date)) return gsecExchangeQuoteTime(value);
  if (!Number.isFinite(+value) || +value <= 0) return null;
  const pad = (part: number) => String(part).padStart(2, '0');
  return gsecExchangeQuoteTime(
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}
