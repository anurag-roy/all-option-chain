import type { GsecRow, GsecSecurity, GsecSellerLevel } from '@shared/types/gsecs';

export function parseGsecSymbol(
  symbol: string
): Pick<GsecSecurity, 'tradingsymbol' | 'coupon' | 'maturityYear'> | null {
  // GR issues also appear in Zerodha's Government Securities category.
  const match = /^(\d{2,4})(?:GS|GR)(\d{4})[A-Z]?(?:-GS)?$/.exec(symbol.trim().toUpperCase());
  if (!match) return null;

  const tradingsymbol = symbol.trim().toUpperCase();
  return {
    tradingsymbol: tradingsymbol.endsWith('-GS') ? tradingsymbol : `${tradingsymbol}-GS`,
    // NSE drops a trailing coupon zero in symbols such as 68GS2060 (6.80%).
    coupon: Number(match[1]!.padEnd(3, '0')),
    maturityYear: Number(match[2]),
  };
}

export function getGsecSellerDepth(levels: GsecSellerLevel[] = []): GsecSellerLevel[] {
  return levels
    .filter(
      (level) =>
        Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.quantity) && level.quantity > 0
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, 5)
    .map(({ price, quantity, orders }) => ({ price, quantity, orders }));
}

type GsecQuote = { depth?: { sell: GsecSellerLevel[] } };

export function rankGsecs(securities: GsecSecurity[], quotes: Record<string, GsecQuote>): GsecRow[] {
  const rows: GsecRow[] = securities.map((security) => {
    const quote = quotes[`NSE:${security.tradingsymbol}`];
    const sellerDepth = getGsecSellerDepth(quote?.depth?.sell);
    const sellRate = sellerDepth[0]?.price ?? null;
    return {
      ...security,
      sellRate,
      rrr: sellRate === null ? null : security.coupon / sellRate,
      // Remove binary floating-point noise so equal distances receive equal ranks.
      distanceFromFv: sellRate === null ? null : Number(Math.abs(sellRate - 100).toFixed(8)),
      bestRrrRank: null,
      nearFvRank: null,
      quoteStatus: sellRate !== null ? 'ready' : quote ? 'no-sellers' : 'unavailable',
      sellerDepth,
      quoteUpdatedAt: null,
    };
  });

  const quotedRows = rows.filter((row) => row.sellRate !== null);
  for (const [valueKey, rankKey, direction] of [
    ['rrr', 'bestRrrRank', -1],
    ['distanceFromFv', 'nearFvRank', 1],
  ] as const) {
    const sorted = [...quotedRows].sort(
      (a, b) => direction * (a[valueKey]! - b[valueKey]!) || a.tradingsymbol.localeCompare(b.tradingsymbol)
    );
    sorted.forEach((row, index) => {
      const previous = sorted[index - 1];
      row[rankKey] = previous && previous[valueKey] === row[valueKey] ? previous[rankKey] : index + 1;
    });
  }

  return rows.sort(
    (a, b) =>
      (a.bestRrrRank ?? Infinity) - (b.bestRrrRank ?? Infinity) || a.tradingsymbol.localeCompare(b.tradingsymbol)
  );
}
