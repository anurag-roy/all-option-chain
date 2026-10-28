import { describe, expect, it } from 'vitest';
import { ClosingSession, isWithinClosingBand } from './closing-session';

const at = (time: string, day = '2026-10-27') => new Date(`${day}T${time}+05:30`);

describe('closing-session LTP freeze', () => {
  it('starts at 15:35:01 IST and includes exactly 15:40:00', () => {
    const session = new ClosingSession();
    const live = new Map([['TEST', 100]]);
    expect(session.getPrices(live, at('15:35:00.999')).frozen).toBe(false);
    expect(session.getPrices(live, at('15:35:01.000')).frozen).toBe(true);
    live.set('TEST', 104);
    expect(session.getPrices(live, at('15:39:59.999')).ltps.get('TEST')).toBe(100);
    expect(session.getPrices(live, at('15:40:00.000')).ltps.get('TEST')).toBe(100);
    const afterClose = session.getPrices(live, at('15:40:00.001'));
    expect(afterClose.frozen).toBe(false);
    expect(afterClose.ltps.get('TEST')).toBe(104);
  });

  it('retains each symbol across replacement maps and freezes new symbols at their first available price', () => {
    const session = new ClosingSession();
    session.getPrices(new Map([['TEST', 100]]), at('15:35:01'));
    const replacement = new Map([
      ['TEST', 110],
      ['OTHER', 200],
    ]);
    const first = session.getPrices(replacement, at('15:36:00'));
    expect(first.ltps.get('TEST')).toBe(100);
    expect(first.ltps.get('OTHER')).toBe(200);
    replacement.set('OTHER', 210);
    expect(session.getPrices(replacement, at('15:37:00')).ltps.get('OTHER')).toBe(200);
  });

  it('takes a new snapshot on the next IST date even without a read outside the window', () => {
    const session = new ClosingSession();
    const live = new Map([['TEST', 100]]);
    session.getPrices(live, at('15:35:01'));
    live.set('TEST', 200);
    expect(session.getPrices(live, at('15:35:01', '2026-10-28')).ltps.get('TEST')).toBe(200);
  });

  it('uses IST when the provided clock is expressed in UTC', () => {
    const session = new ClosingSession();
    const live = new Map([['TEST', 100]]);
    expect(session.getPrices(live, new Date('2026-10-27T10:05:00.999Z')).frozen).toBe(false);
    expect(session.getPrices(live, new Date('2026-10-27T10:05:01.000Z')).frozen).toBe(true);
  });
});

describe('closing strike exclusion band', () => {
  it.each([
    [97.49, false],
    [97.5, true],
    [100, true],
    [102.5, true],
    [102.51, false],
  ])('excludes strike %s around an LTP of 100: %s', (strike, expected) => {
    expect(isWithinClosingBand(strike, 100)).toBe(expected);
  });
});
