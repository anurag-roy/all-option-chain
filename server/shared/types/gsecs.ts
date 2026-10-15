import type { GsecCurveAnalytics, GsecCurveCarry, GsecCurvePoint, GsecCurveState } from './gsec-curve';
import type { GsecOpportunityRating } from './gsec-rating';

export type GsecSecurity = {
  tradingsymbol: string;
  isin: string;
  coupon: number;
  maturityYear: number;
};

export type GsecBond = GsecSecurity & { maturityDate: string };

export type GsecExchange = 'NSE' | 'BSE';

// Bond terms are shared by ISIN; prices and trading identifiers belong to a venue.
export type GsecListing = GsecBond & { exchange: GsecExchange; tickSize: number };

export type GsecCatalogSnapshot = {
  securities: (GsecListing & { instrumentToken: number })[];
  fetchedAt: string;
  day: string;
  tradeDate: string;
  settlementDate: string;
};

export type GsecSellerLevel = {
  price: number;
  quantity: number;
  orders: number;
};

export type GsecRisk = {
  macaulayDuration: number; // Years.
  modifiedDuration: number; // Years; displayed in months in the UI.
  dv01: number | null; // Positive symmetric +/-1 bp price sensitivity per Rs.100 FV.
  convexity: number | null; // Central +/-1 bp repricing; decimal annual yield units.
};

export type GsecScenario = {
  shockBp: number;
  yieldPercent: number;
  dirtyPrice: number | null;
  priceChangePercent: number | null;
};

export type GsecCarry = {
  months: number;
  horizonDate: string;
  effectiveHorizonDate: string;
  maturesBeforeHorizon: boolean;
  endingDirtyPrice: number | null;
  couponsReceived: number;
  redemptionReceived: number;
  returnPercent: number | null; // Gross holding-period return, not annualized.
};

export type GsecAnalytics = {
  ytm: number;
  nextCouponDate: string;
  remainingCoupons: number;
  risk: GsecRisk | null;
  scenarios: GsecScenario[];
  carry: GsecCarry[]; // Constant current YTM; no reinvestment or curve assumption.
};

export type GsecRow = GsecListing & {
  sellRate: number | null;
  rrr: number | null;
  analytics: GsecAnalytics | null;
  curveAnalytics: GsecCurveAnalytics | null;
  curveUnavailableReason: string | null;
  bestRrrRank: number | null;
  distanceFromFv: number | null;
  nearFvRank: number | null;
  quoteStatus: 'ready' | 'no-sellers' | 'unavailable';
  sellerDepth: GsecSellerLevel[];
  quoteUpdatedAt: string | null;
  masterDataStatus: 'ready' | 'invalid';
};

export type GsecScan = {
  rows: GsecRow[];
  scenarioBase: number;
  sourceUrl: string;
  approvedListFetchedAt: string;
  quotesFetchedAt: string;
  revision: number;
  tradeDate: string;
  settlementDate: string;
  streamStatus: 'live' | 'disconnected' | 'error';
  curve?: GsecCurveState;
  curvePoints?: GsecCurvePoint[];
  message?: string;
};

export type GsecDepth = {
  exchange: GsecExchange;
  tradingsymbol: string;
  sell: GsecSellerLevel[];
  fetchedAt: string;
};

export type GsecTargetPrices = {
  targetYtm: number;
  settlementDate: string;
  approvedListFetchedAt: string;
  prices: Record<string, number | null>;
  theoreticalPrices: Record<string, number | null>;
};

export type GsecBondAnalytics = {
  exchange: GsecExchange;
  tradingsymbol: string;
  settlementDate: string;
  approvedListFetchedAt: string;
  sellRate: number | null;
  curveSnapshotId: string | null;
  targetYtm: number | null;
  customMonths: number | null;
  rating: GsecOpportunityRating;
  customCarry: GsecCarry | null;
  customCarryRoll: GsecCurveCarry | null;
};
