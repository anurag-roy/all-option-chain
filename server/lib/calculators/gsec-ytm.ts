type BondDate = { year: number; month: number; day: number };

export function parseBondDate(value: string): BondDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

// RBI specifies semiannual coupons and European 30/360 (Excel YIELD basis 4).
// https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711 (sections 24–25)
function days30E360(from: BondDate, to: BondDate): number {
  return (to.year - from.year) * 360 + (to.month - from.month) * 30 + Math.min(to.day, 30) - Math.min(from.day, 30);
}

function couponDate(maturity: BondDate, periodsBeforeMaturity: number): string {
  const month = new Date(Date.UTC(maturity.year, maturity.month - 1 - periodsBeforeMaturity * 6, 1));
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  month.setUTCDate(Math.min(maturity.day, lastDay));
  return month.toISOString().slice(0, 10);
}

/** Quoted annual YTM in percent, using the NSE seller's dirty price per ₹100 FV. */
export function calculateGsecYtm({
  dirtyPrice,
  coupon,
  settlementDate,
  maturityDate,
}: {
  dirtyPrice: number;
  coupon: number; // Normalized symbol number: 676 means 6.76% per year.
  settlementDate: string;
  maturityDate: string;
}): number | null {
  const settlement = parseBondDate(settlementDate);
  const maturity = parseBondDate(maturityDate);
  if (
    !settlement ||
    !maturity ||
    maturityDate <= settlementDate ||
    !Number.isFinite(dirtyPrice) ||
    dirtyPrice <= 0 ||
    !Number.isFinite(coupon) ||
    coupon < 0
  )
    return null;

  let remainingCoupons = 0;
  let nextCoupon = maturityDate;
  // Bound malformed inputs, rather than constructing an unbounded schedule.
  for (let periods = 0; periods < 400; periods++) {
    const date = couponDate(maturity, periods);
    if (date <= settlementDate) break;
    nextCoupon = date;
    remainingCoupons++;
  }
  if (!remainingCoupons || remainingCoupons === 400) return null;
  const fraction = days30E360(settlement, parseBondDate(nextCoupon)!) / 180;
  // A February month-end coupon can leave slightly more than 180 European
  // 30/360 days to the next coupon; that still defines a valid discount period.
  if (fraction <= 0) return null;
  const halfYearCoupon = coupon / 200;
  const presentValue = (yieldRate: number) => {
    const base = 1 + yieldRate / 2;
    let value = 100 / base ** (fraction + remainingCoupons - 1);
    for (let i = 0; i < remainingCoupons; i++) value += halfYearCoupon / base ** (fraction + i);
    return value;
  };

  // Check the bracket; a fixed 0–30% search silently clamps negative/high yields.
  let low = -1.999999;
  let high = 0.3;
  if (presentValue(low) < dirtyPrice) return null;
  for (let i = 0; presentValue(high) > dirtyPrice && i < 40; i++) high *= 2;
  if (presentValue(high) > dirtyPrice) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > dirtyPrice) low = mid;
    else high = mid;
  }
  const yieldPercent = ((low + high) / 2) * 100;
  return Number.isFinite(yieldPercent) ? yieldPercent : null;
}
