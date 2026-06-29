import {
  calculateAsymmetricBounds,
  calculateSd,
  calculateSigmaN,
  calculateSigmaX,
  calculateSigmaXi,
  filterStrikesByBounds,
} from '@server/lib/calculators/sigma';
import type { DbInstrument } from '@server/lib/services/instrument-catalog';
import { workingDaysCache } from '@server/lib/services/working-days-cache';
import type { OptionType } from '@shared/types/types';

export type PlannedInstrument = DbInstrument & {
  underlyingLtp: number;
  futExpiry: string;
};

export async function planInstrumentsForSymbol(
  _symbol: string,
  expiry: string,
  sdMultiplier: number,
  options: DbInstrument[],
  futures: DbInstrument[],
  underlyingLtp: number
): Promise<PlannedInstrument[]> {
  const [futExpiry] = futures
    .map((future) => future.expiry!)
    .filter((futureExpiry) => futureExpiry > expiry)
    .sort();

  if (!futExpiry) {
    return [];
  }

  const stockWithAv = options.find((option) => option.av && option.av > 0);
  let ceBound = underlyingLtp;
  let peBound = underlyingLtp;

  if (stockWithAv?.av && stockWithAv.expiry) {
    const workingDaysInLastYear = await workingDaysCache.getWorkingDaysInLastYear();
    const workingDaysTillExpiry = await workingDaysCache.getWorkingDaysTillExpiry(expiry);
    const sigma = calculateSd(stockWithAv.av, workingDaysInLastYear, workingDaysTillExpiry);
    const sigmaN = calculateSigmaN(sigma, sdMultiplier);
    const sigmaX = calculateSigmaX(sigmaN, workingDaysInLastYear, workingDaysTillExpiry);
    const sigmaXi = calculateSigmaXi(sigmaN, sigmaX, 'CE');
    ({ ceBound, peBound } = calculateAsymmetricBounds(underlyingLtp, sigmaXi));
  }

  const putStrikes = options
    .filter((option) => option.instrumentType === 'PE')
    .map((option) => option.strike!)
    .sort((a, b) => b - a);

  const callStrikes = options
    .filter((option) => option.instrumentType === 'CE')
    .map((option) => option.strike!)
    .sort((a, b) => a - b);

  const { closestFloorStrike, closestCeilingStrike } = filterStrikesByBounds(putStrikes, callStrikes, peBound, ceBound);

  const filtered = options.filter((option) => {
    if (option.instrumentType === 'PE') {
      return closestFloorStrike ? option.strike! <= closestFloorStrike : false;
    }
    if (option.instrumentType === 'CE') {
      return closestCeilingStrike ? option.strike! >= closestCeilingStrike : false;
    }
    return false;
  });

  return filtered.map((option) => ({
    ...option,
    underlyingLtp,
    futExpiry,
  }));
}

export function instrumentQuoteKey(instrument: Pick<DbInstrument, 'exchange' | 'tradingsymbol'>) {
  return `${instrument.exchange}:${instrument.tradingsymbol}`;
}

export function isValidOptionType(value: string | null | undefined): value is OptionType {
  return value === 'CE' || value === 'PE';
}
