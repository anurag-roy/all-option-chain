const IST_OFFSET_MS = 330 * 60_000;
const FREEZE_START_MS = (15 * 3600 + 35 * 60 + 1) * 1000;
const FREEZE_END_MS = (15 * 3600 + 40 * 60) * 1000;

/** Daily underlying-price freeze, independent of the selected chain filter. */
export class ClosingSession {
  private day: string | null = null;
  private frozenLtps = new Map<string, number>();

  getPrices(
    liveLtps: ReadonlyMap<string, number>,
    now = new Date()
  ): { ltps: ReadonlyMap<string, number>; frozen: boolean } {
    // IST has no daylight-saving changes; use UTC accessors to ignore the host timezone.
    const indiaTime = new Date(now.getTime() + IST_OFFSET_MS);
    const timeMs =
      ((indiaTime.getUTCHours() * 60 + indiaTime.getUTCMinutes()) * 60 + indiaTime.getUTCSeconds()) * 1000 +
      indiaTime.getUTCMilliseconds();
    const day = timeMs >= FREEZE_START_MS && timeMs <= FREEZE_END_MS ? indiaTime.toISOString().slice(0, 10) : null;

    if (day !== this.day) {
      this.frozenLtps.clear();
      this.day = day;
    }
    if (!day) return { ltps: liveLtps, frozen: false };

    for (const [symbol, ltp] of liveLtps) {
      // A symbol first loaded during the window uses its first available quote.
      if (!this.frozenLtps.has(symbol)) this.frozenLtps.set(symbol, ltp);
    }
    return { ltps: this.frozenLtps, frozen: true };
  }
}

/** Include both +/-2.5% boundaries, without rounding them to option strikes. */
export function isWithinClosingBand(strike: number, ltp: number): boolean {
  return strike * 1000 >= ltp * 975 && strike * 1000 <= ltp * 1025;
}
