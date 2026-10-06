import { parseGsecSymbol } from '@server/lib/calculators/gsecs';
import { LEGACY_GSECS } from '@server/scripts/data/legacy-gsecs';
import { parseNseBondDate } from '@server/scripts/lib/gsec-settlement';
import type { GsecBond, GsecSecurity } from '@shared/types/gsecs';
import { csv2json } from 'json-2-csv';

export const NSE_DEBT_MASTER = 'https://nsearchives.nseindia.com/content/equities/DEBT.csv';
type Terms = Pick<GsecBond, 'tradingsymbol' | 'coupon' | 'maturityDate'>;
const legacy = new Map<string, Terms>(
  LEGACY_GSECS.map(([isin, tradingsymbol, coupon, maturityDate]) => [isin, { tradingsymbol, coupon, maturityDate }])
);

export function parseNseGsecTerms(csv: string): Map<string, Terms> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .replaceAll('\r\n', '\n')
    .split('\n');
  const header = lines[0]?.trim();
  if (!header) throw new Error('NSE debt master is empty');
  const fields = header.split(',').map((field) => field.trim());
  // NSE currently provides 14 headings but 15 values; the last value is ISIN.
  if (!fields.includes('ISIN') && fields.length === 14 && fields[13] === 'INTEREST PAYMENT DT') {
    lines[0] = `${header},ISIN`;
    fields.push('ISIN');
  }
  for (const required of ['SYMBOL', 'SERIES', 'NAME OF COMPANY', 'FACE VALUE', 'IP RATE', 'REDEMPTION DATE', 'ISIN']) {
    if (!fields.includes(required)) throw new Error(`NSE debt master is missing ${required}`);
  }
  const rows = csv2json(lines.join('\n'), {
    trimHeaderFields: true,
    trimFieldValues: true,
    parseValue: (value) => value,
  });
  const terms = new Map<string, Terms>();
  for (const row of rows as Record<string, string>[]) {
    if (row.SERIES !== 'GS') continue;
    const symbol = parseGsecSymbol(row.SYMBOL ?? '');
    if (!symbol) continue;
    const maturityDate = parseNseBondDate(row['REDEMPTION DATE'] ?? '');
    const rate = Number(row['IP RATE']);
    const isin = row.ISIN;
    if (
      !maturityDate ||
      !isin ||
      !/^IN[A-Z0-9]{10}$/.test(isin) ||
      row['NAME OF COMPANY']?.toUpperCase() !== 'GOVERNMENT OF INDIA' ||
      Number(row['FACE VALUE']) !== 100 ||
      (row['REDEMPTION AMT'] && Number(row['REDEMPTION AMT']) !== 100) ||
      !row['IP RATE'] ||
      !Number.isFinite(rate) ||
      Math.abs(rate * 100 - symbol.coupon) > 1e-8 ||
      Number(maturityDate.slice(0, 4)) !== symbol.maturityYear
    ) {
      throw new Error(`Invalid NSE bond terms for ${symbol.tradingsymbol}`);
    }
    const value = { tradingsymbol: symbol.tradingsymbol, coupon: symbol.coupon, maturityDate };
    const duplicate = terms.get(isin);
    if (duplicate && (duplicate.coupon !== value.coupon || duplicate.maturityDate !== value.maturityDate)) {
      throw new Error(`Conflicting NSE bond terms for ${isin}`);
    }
    terms.set(isin, value);
  }
  if (!terms.size) throw new Error('NSE debt master contains no fixed-coupon G-Secs');
  return terms;
}

export function resolveGsecTerms(security: GsecSecurity, daily: Map<string, Terms>): GsecBond {
  const current = daily.get(security.isin);
  const reference = legacy.get(security.isin);
  if (
    current &&
    reference &&
    (current.coupon !== reference.coupon || current.maturityDate !== reference.maturityDate)
  ) {
    throw new Error(`NSE and legacy bond terms disagree for ${security.tradingsymbol}`);
  }
  const terms = current ?? reference;
  if (!terms)
    throw new Error(
      `Missing verified maturity date for ${security.tradingsymbol} (${security.isin}). G-Sec seed aborted.`
    );
  if (
    terms.tradingsymbol !== security.tradingsymbol ||
    terms.coupon !== security.coupon ||
    Number(terms.maturityDate.slice(0, 4)) !== security.maturityYear
  ) {
    throw new Error(`Approved and reference bond terms disagree for ${security.tradingsymbol}`);
  }
  return { ...security, maturityDate: terms.maturityDate };
}
