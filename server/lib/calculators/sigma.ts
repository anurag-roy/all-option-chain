import type { OptionType } from '@shared/types/types';

export const calculateSigmaN = (sigma: number, sdMultiplier: number) => sigma * sdMultiplier;

export const calculateSigmaX = (sigmaN: number, marketMinutesInLastYear: number, marketMinutesTillExpiry: number) => {
  if (!sigmaN || sigmaN <= 0 || marketMinutesTillExpiry === 0 || marketMinutesInLastYear === 0) {
    return 0;
  }
  return sigmaN / Math.sqrt(marketMinutesInLastYear / marketMinutesTillExpiry);
};

export const calculateSigmaXi = (sigmaN: number, sigmaX: number, optionType: OptionType) => {
  if (!sigmaN || sigmaN < 0 || !sigmaX || sigmaX < 0) {
    return 0;
  }
  return optionType === 'CE' ? sigmaN + sigmaX : sigmaN - sigmaX;
};

export const calculateSd = (av: number, marketMinutesInLastYear: number, marketMinutesTillExpiry: number) => {
  if (marketMinutesTillExpiry === 0 || marketMinutesInLastYear === 0) {
    return 0;
  }
  return (av * 100) / Math.sqrt(marketMinutesInLastYear / marketMinutesTillExpiry);
};

export const calculateAsymmetricBounds = (ltp: number, sigmaXi: number) => ({
  ceBound: ltp + (ltp * sigmaXi) / 100,
  peBound: ltp - (ltp * sigmaXi) / 100,
});
