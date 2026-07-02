import { TZDate } from '@date-fns/tz';
import {
  FULL_TRADING_DAY_MINUTES,
  calculateMarketMinutesInRange,
  calculateMarketMinutesTillExpiry,
  loadHolidayCache,
} from '@server/lib/market-minutes';

async function main() {
  await loadHolidayCache();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const minutesInLastYear = calculateMarketMinutesInRange(oneYearAgo, new Date());
  console.assert(minutesInLastYear > 90_000, `Expected >90k minutes in last year, got ${minutesInLastYear}`);

  const futureExpiry = calculateMarketMinutesTillExpiry('2026-07-30');
  console.assert(futureExpiry > 0, `Expected positive minutes till expiry, got ${futureExpiry}`);

  const weekendStatus = new TZDate('2026-07-05', 'Asia/Kolkata');
  console.log('weekend check date:', weekendStatus.toISOString());

  console.log('minutes in last year:', minutesInLastYear);
  console.log('minutes till 2026-07-30:', futureExpiry);
  console.log('full trading day minutes:', FULL_TRADING_DAY_MINUTES);
  console.log('all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
