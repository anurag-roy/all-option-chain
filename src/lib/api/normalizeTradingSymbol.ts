/**
 * Pi occasionally expects strike suffixes without trailing zeros
 * (e.g. `...P302.5` instead of `...P302.50`).
 * This keeps non-option symbols unchanged and normalizes only terminal decimals.
 */
export const normalizeTradingSymbol = (tsym: string) =>
  tsym
    .trim()
    .replace(/(\d+\.\d*?[1-9])0+$/, '$1')
    .replace(/(\d+)\.0+$/, '$1');
