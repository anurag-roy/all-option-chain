import type { OptionType } from '@shared/types/types';

export const calculateSigmaN = (sigma: number, sdMultiplier: number) => sigma * sdMultiplier;

export const calculateSigmaX = (sigmaN: number, workingDaysInLastYear: number, workingDaysTillExpiry: number) => {
  if (!sigmaN || sigmaN <= 0 || workingDaysTillExpiry === 0 || workingDaysInLastYear === 0) {
    return 0;
  }
  return sigmaN / Math.sqrt(workingDaysInLastYear / workingDaysTillExpiry);
};

export const calculateSigmaXi = (sigmaN: number, sigmaX: number, optionType: OptionType) => {
  if (!sigmaN || sigmaN < 0 || !sigmaX || sigmaX < 0) {
    return 0;
  }
  return optionType === 'CE' ? sigmaN + sigmaX : sigmaN - sigmaX;
};

export const calculateSd = (av: number, workingDaysInLastYear: number, workingDaysTillExpiry: number) => {
  if (workingDaysTillExpiry === 0 || workingDaysInLastYear === 0) {
    return 0;
  }
  return (av * 100) / Math.sqrt(workingDaysInLastYear / workingDaysTillExpiry);
};

export const calculateAsymmetricBounds = (ltp: number, sigmaXi: number) => ({
  ceBound: ltp + (ltp * sigmaXi) / 100,
  peBound: ltp - (ltp * sigmaXi) / 100,
});

export const filterStrikesByBounds = (
  putStrikes: number[],
  callStrikes: number[],
  peBound: number,
  ceBound: number
) => {
  const closestFloorStrike = putStrikes.find((strike) => strike <= peBound) ?? putStrikes.at(-1);
  const closestCeilingStrike = callStrikes.find((strike) => strike >= ceBound) ?? callStrikes.at(-1);

  return { closestFloorStrike, closestCeilingStrike };
};
