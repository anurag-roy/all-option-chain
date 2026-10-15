type BondDate = { year: number; month: number; day: number };

export type GsecBondTerms = {
  coupon: number; // Normalized symbol number: 709 means 7.09% per year.
  settlementDate: string;
  maturityDate: string;
};

export type GsecCashFlow = {
  date: string;
  amount: number;
  periods: number; // Semiannual 30E/360 discount periods from settlement.
};

export function parseBondDate(value: string): BondDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

// RBI's European 30/360 convention (Excel YIELD basis 4).
function days30E360(from: BondDate, to: BondDate): number {
  return (to.year - from.year) * 360 + (to.month - from.month) * 30 + Math.min(to.day, 30) - Math.min(from.day, 30);
}

/** Add calendar months, retaining the original day and clamping shorter months. */
export function addBondMonths(value: string, months: number): string | null {
  const date = parseBondDate(value);
  if (!date || !Number.isSafeInteger(months)) return null;
  const target = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole calendar months, then fractional months times 30, rounded to whole days. */
export function addBondHorizonMonths(value: string, months: number): string | null {
  if (!Number.isFinite(months) || months <= 0 || months > 1200) return null;
  const wholeMonths = Math.floor(months);
  const anchor = addBondMonths(value, wholeMonths);
  if (!anchor) return null;
  const date = new Date(`${anchor}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.round((months - wholeMonths) * 30));
  const horizon = date.toISOString().slice(0, 10);
  return horizon > value ? horizon : null;
}

/** Coupons strictly after settlement; redemption is included exactly once. */
export function createGsecCashFlows({ coupon, settlementDate, maturityDate }: GsecBondTerms): GsecCashFlow[] | null {
  const settlement = parseBondDate(settlementDate);
  if (
    !settlement ||
    !parseBondDate(maturityDate) ||
    maturityDate <= settlementDate ||
    !Number.isFinite(coupon) ||
    coupon < 0
  )
    return null;

  const dates: string[] = [];
  for (let periods = 0; periods < 400; periods++) {
    // Always anchor to maturity, so February clamping never shifts later coupons.
    const date = addBondMonths(maturityDate, -periods * 6);
    if (date === null) return null;
    if (date <= settlementDate) break;
    dates.unshift(date);
  }
  if (!dates.length || dates.length === 400) return null;
  const fraction = days30E360(settlement, parseBondDate(dates[0]!)!) / 180;
  // February month-end can leave slightly more than one 30E/360 period.
  if (fraction <= 0) return null;
  return dates.map((date, index) => ({
    date,
    amount: coupon / 200 + (date === maturityDate ? 100 : 0),
    periods: fraction + index,
  }));
}

/** Unrounded dirty price; yieldPercent is quoted annual YTM, not a decimal. */
export function priceGsecCashFlows(cashFlows: GsecCashFlow[], yieldPercent: number): number {
  const base = 1 + yieldPercent / 200;
  return cashFlows.reduce((value, flow) => value + flow.amount / base ** flow.periods, 0);
}
