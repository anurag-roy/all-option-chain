import { parseGsecSymbol } from '@server/lib/calculators/gsecs';
import { LEGACY_GSECS } from '@server/scripts/data/legacy-gsecs';
import { describe, expect, it } from 'vitest';
import { parseNseGsecTerms, resolveGsecTerms } from './gsec-terms';

const header =
  'SYMBOL, NAME OF COMPANY, SERIES, FACE VALUE, PAID UP VALUE, MKT LOT, IP RATE, DATE OF LISTING, DATE OF ALLOTMENT, REDEMPTION DATE, REDEMPTION AMT, CONVERSION DATE, CONVERSION AMT, INTEREST PAYMENT DT';
const row = '676GS2061,Government of India,GS,100,100,1,6.76,23-FEB-2021,,22-FEB-2061,,,,,IN0020200401';
const approved = { ...parseGsecSymbol('676GS2061')!, isin: 'IN0020200401' };
describe('verified G-Sec terms', () => {
  it('parses NSE’s unnamed trailing ISIN field and CRLF records', () => {
    expect(resolveGsecTerms(approved, parseNseGsecTerms(`${header}\r\n${row}\r\n`))).toMatchObject({
      maturityDate: '2061-02-22',
      coupon: 676,
    });
  });
  it('handles quoted CSV fields without corrupting column positions', () => {
    const csv = `${header},ISIN\n${row.replace('676GS2061', '"676GS2061"')}\n`;
    expect(parseNseGsecTerms(csv).has(approved.isin)).toBe(true);
  });
  it('uses all 36 legacy records by ISIN, preserving distinct shortened names', () => {
    expect(LEGACY_GSECS).toHaveLength(36);
    for (const [isin, symbol, coupon, maturityDate] of LEGACY_GSECS) {
      expect(resolveGsecTerms({ ...parseGsecSymbol(symbol)!, isin }, new Map())).toMatchObject({
        coupon,
        maturityDate,
      });
    }
  });
  it('rejects unknown ISINs, wrong coupons and conflicts between sources', () => {
    expect(() => resolveGsecTerms({ ...approved, isin: 'IN0000000000' }, new Map())).toThrow('Missing verified');
    expect(() => resolveGsecTerms({ ...approved, coupon: 750 }, parseNseGsecTerms(`${header}\n${row}`))).toThrow(
      'disagree'
    );
    const legacy = { ...parseGsecSymbol('75GS2034')!, isin: 'IN0020040039' };
    const conflict = new Map([
      [legacy.isin, { tradingsymbol: legacy.tradingsymbol, coupon: 750, maturityDate: '2034-08-11' }],
    ]);
    expect(() => resolveGsecTerms(legacy, conflict)).toThrow('NSE and legacy');
  });
  it.each([
    '',
    'not,a,bond,master',
    `${header}\n${row.replace('22-FEB-2061', '30-FEB-2061')}`,
    `${header}\n${row.replace('6.76', '6.75')}`,
    `${header}\n${row.replace(',100,100,', ',1000,1000,')}`,
  ])('rejects malformed, conflicting or unsupported terms', (csv) => {
    expect(() => parseNseGsecTerms(csv)).toThrow();
  });
});
