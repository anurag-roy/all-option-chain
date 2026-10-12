export type NssParameters = {
  beta0: number;
  beta1: number;
  beta2: number;
  beta3: number;
  tau1: number;
  tau2: number;
};

export type GsecCurveSnapshot = {
  id: string;
  provider: 'CCIL';
  referenceDate: string;
  publicationTimestamp: string | null; // Null when the source does not publish it.
  firstObservedAt: string; // Conservative availability time when publication is unknown.
  retrievedAt: string;
  sourceUrl: string;
  sourceHash: string;
  method: 'NSS';
  parameters: NssParameters; // Rates in percent, tau in years.
  compounding: 'continuous' | 'annual' | 'semiannual';
  dayCount: 'ACT/365' | 'ACT/360' | '30E/360';
  conventionSource: string;
  minTenor: number;
  maxTenor: number;
};

export type GsecCurveState = {
  status: 'ready' | 'stale' | 'unavailable';
  snapshot: GsecCurveSnapshot | null;
  ageDays: number | null;
  rvThresholdBp: number;
  message?: string;
};

export type GsecRelativeValue = 'CHEAP' | 'FAIR' | 'RICH';

export type GsecCurveCarry = {
  months: 1 | 3 | 6 | 12;
  fairDirtyPrice: number | null;
  fairYtm: number | null;
  assumedYtm: number | null;
  endingDirtyPrice: number | null;
  returnPercent: number | null;
};

export type GsecCurveAnalytics = {
  snapshotId: string;
  fairDirtyPrice: number;
  fairYtm: number;
  spreadBp: number | null;
  relativeValue: GsecRelativeValue | null;
  priceAdvantage: number | null; // Fair minus market dirty price per Rs.100 FV.
  maturityTenor: number;
  carryRoll: GsecCurveCarry[];
};

export type GsecCurvePoint = { tenor: number; zeroRate: number };
