export type GsecRatingColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue';
export type GsecRatingFactorId = 'target' | 'value' | 'carry' | 'sensitivity';

export type GsecRatingFactor = {
  id: GsecRatingFactorId;
  label: string;
  weight: number;
  actual: number | null;
  ratioPercent?: number | null;
  score: number | null;
  contribution: number | null;
  color: GsecRatingColor | null;
};

export type GsecOpportunityRating = {
  score: number | null;
  color: GsecRatingColor | null;
  label: string;
  factors: GsecRatingFactor[];
  unavailableReason: string | null;
};
