import { selectApprovedGsecs } from '@server/lib/services/approved-gsecs';
import { describe, expect, it } from 'vitest';

const approved = {
  symbol: '750GS2056',
  isin: 'IN0020250174',
  security_type: 'Government Securities',
  is_unapproved: 0,
  limit_breached: false,
};

describe('approved G-Sec selection', () => {
  it('excludes unapproved, limit-breached and non-G-Sec instruments', () => {
    expect(
      selectApprovedGsecs([
        approved,
        { ...approved },
        { ...approved, symbol: '680GS2060', is_unapproved: 1 },
        { ...approved, symbol: '720GS2034', limit_breached: true },
        { ...approved, symbol: '825GS2035', security_type: 'Equity' },
        { ...approved, symbol: 'SGBSEP31II-GB', security_type: 'Sovereign Gold Bond' },
      ])
    ).toEqual([{ tradingsymbol: '750GS2056-GS', isin: approved.isin, coupon: 750, maturityYear: 2056 }]);
  });

  it('fails closed if the source omits eligibility flags or changes shape', () => {
    expect(() =>
      selectApprovedGsecs([{ symbol: '750GS2056', isin: approved.isin, security_type: 'Government Securities' }])
    ).toThrow();
    expect(() => selectApprovedGsecs({ data: [approved] })).toThrow();
    expect(() => selectApprovedGsecs([])).toThrow();
  });
});
