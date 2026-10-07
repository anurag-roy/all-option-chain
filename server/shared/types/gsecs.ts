export type GsecSecurity = {
  tradingsymbol: string;
  isin: string;
  coupon: number;
  maturityYear: number;
};

export type GsecBond = GsecSecurity & { maturityDate: string };

export type GsecCatalogSnapshot = {
  securities: (GsecBond & { instrumentToken: number })[];
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

export type GsecRow = GsecBond & {
  sellRate: number | null;
  rrr: number | null;
  bestRrrRank: number | null;
  distanceFromFv: number | null;
  nearFvRank: number | null;
  quoteStatus: 'ready' | 'no-sellers' | 'unavailable';
  sellerDepth: GsecSellerLevel[];
  quoteUpdatedAt: string | null;
};

export type GsecScan = {
  rows: GsecRow[];
  sourceUrl: string;
  approvedListFetchedAt: string;
  quotesFetchedAt: string;
  revision: number;
  tradeDate: string;
  settlementDate: string;
  streamStatus: 'live' | 'disconnected' | 'error';
  message?: string;
};

export type GsecDepth = {
  tradingsymbol: string;
  sell: GsecSellerLevel[];
  fetchedAt: string;
};

export type GsecTargetPrices = {
  targetYtm: number;
  settlementDate: string;
  approvedListFetchedAt: string;
  prices: Record<string, number | null>;
};
