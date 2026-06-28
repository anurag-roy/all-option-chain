import { RISK_FREE_RATE } from '@server/shared/config';

const a1 = 0.254829592;
const a2 = -0.284496736;
const a3 = 1.421413741;
const a4 = -1.453152027;
const a5 = 1.061405429;
const p = 0.3275911;

const normalCdf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
};

export const calculateDelta = (
  spotPrice: number,
  strikePrice: number,
  volatility: number,
  timeToExpiry: number,
  optionType: 'CE' | 'PE'
): number => {
  if (timeToExpiry <= 0 || volatility <= 0 || spotPrice <= 0 || strikePrice <= 0) {
    return 0;
  }

  const d1Numerator =
    Math.log(spotPrice / strikePrice) + (RISK_FREE_RATE + 0.5 * volatility * volatility) * timeToExpiry;
  const d1 = d1Numerator / (volatility * Math.sqrt(timeToExpiry));
  const nd1 = normalCdf(d1);

  return optionType === 'CE' ? nd1 : nd1 - 1;
};
