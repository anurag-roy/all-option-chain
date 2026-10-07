import { extractBseSecurityMaster, matchBseGsecs, type GsecInstrument } from '@server/scripts/lib/bse-gsecs';
import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const nse: GsecCatalogSnapshot['securities'][number] = {
  exchange: 'NSE',
  tradingsymbol: '709GS2054-GS',
  instrumentToken: 1,
  tickSize: 0.01,
  isin: 'IN0020240118',
  coupon: 709,
  maturityYear: 2054,
  maturityDate: '2054-08-05',
};
const bse: GsecInstrument = {
  exchange: 'BSE',
  exchange_token: '800618',
  instrument_token: '204958212',
  tradingsymbol: '709GOI54',
  tick_size: 0.05,
};
const header = 'FinInstrmId,TckrSymb,SctySrs,ISIN,ParVal,SctyTpFlg,BidIntrvl,Xchg,Sts,FinInstrmTp,IPRate';
const row = {
  FinInstrmId: '800618',
  TckrSymb: '709GOI54',
  SctySrs: 'G',
  ISIN: nse.isin,
  ParVal: '10000',
  SctyTpFlg: 'GS',
  BidIntrvl: '0.05',
  Xchg: 'BSE',
  Sts: 'A',
  FinInstrmTp: 'D',
  IPRate: '999',
};
function csv(...rows: Partial<typeof row>[]) {
  return `${header}\r\n${rows
    .map((value) =>
      header
        .split(',')
        .map((key) => ({ ...row, ...value })[key as keyof typeof row])
        .join(',')
    )
    .join('\r\n')}\r\n`;
}

describe('BSE security-master matching', () => {
  it('joins ISIN to the NSE terms and BSE scrip code to the broker token, ignoring BSE coupon data and names', () => {
    expect(matchBseGsecs([nse], [bse], csv({}))).toEqual([
      { ...nse, exchange: 'BSE', tradingsymbol: '709GOI54', instrumentToken: 204958212, tickSize: 0.05 },
    ]);
    expect(matchBseGsecs([nse], [bse], csv({ ISIN: 'IN0020240999', TckrSymb: nse.tradingsymbol }))).toEqual([]);
  });

  it('omits unavailable, suspended and unapproved BSE bonds without removing the approved NSE bond', () => {
    expect(matchBseGsecs([nse], [], csv({}))).toEqual([]);
    expect(matchBseGsecs([nse], [{ ...bse, exchange: 'NSE' }], csv({}))).toEqual([]);
    expect(matchBseGsecs([nse], [bse], csv({ Sts: 'S' }))).toEqual([]);
    expect(matchBseGsecs([], [bse], csv({}))).toEqual([]);
    expect(nse.exchange).toBe('NSE');
  });

  it('rejects a broker-available clean-price counterpart instead of treating it as dirty', () => {
    expect(() => matchBseGsecs([nse], [bse], csv({ SctySrs: 'GC', FinInstrmTp: 'C' }))).toThrow('quote convention');
    expect(matchBseGsecs([nse], [], csv({ SctySrs: 'GC', FinInstrmTp: 'C' }))).toEqual([]);
  });

  it.each([{ ParVal: '100000' }, { BidIntrvl: '0.01' }, { TckrSymb: 'WRONG' }, { FinInstrmTp: 'C' }])(
    'rejects contradictory matched listing data %j',
    (invalid) => {
      expect(() => matchBseGsecs([nse], [bse], csv(invalid))).toThrow();
    }
  );

  it.each([{ instrument_token: '0' }, { instrument_token: 'NaN' }, { tick_size: 0 }, { tick_size: 0.0025 }])(
    'rejects an invalid broker token or tick %j',
    (invalid) => {
      expect(() => matchBseGsecs([nse], [{ ...bse, ...invalid }], csv({}))).toThrow();
    }
  );

  it('rejects duplicate listings and malformed masters', () => {
    expect(() => matchBseGsecs([nse], [bse], csv({}, {}))).toThrow('Duplicate BSE listing');
    expect(() => matchBseGsecs([nse], [bse], 'ISIN,TckrSymb\n')).toThrow('missing FinInstrmId');
    expect(() => matchBseGsecs([nse], [bse], csv({ SctyTpFlg: 'EQ' }))).toThrow('no government securities');
  });
});

describe('BSE daily ZIP extraction', () => {
  it('extracts only the dated security-master CSV, ignoring other files in the official archive', () => {
    const text = csv({});
    const archive = zipSync({
      'SCRIP/BSE_EQ_SCRIP_07102026.csv': strToU8(text),
      'SCRIP/SCRIP_071026.TXT': strToU8('unused'),
      'SCRIP/format.docx': strToU8('unused'),
    });
    expect(extractBseSecurityMaster(archive)).toBe(text);
  });

  it('rejects invalid archives and missing or ambiguous dated masters', () => {
    expect(() => extractBseSecurityMaster(strToU8('upstream error page'))).toThrow();
    expect(() => extractBseSecurityMaster(zipSync({ 'other.csv': strToU8(csv({})) }))).toThrow('one dated');
    expect(() =>
      extractBseSecurityMaster(
        zipSync({
          'BSE_EQ_SCRIP_07102026.csv': strToU8(csv({})),
          'BSE_EQ_SCRIP_08102026.csv': strToU8(csv({})),
        })
      )
    ).toThrow('one dated');
  });
});
