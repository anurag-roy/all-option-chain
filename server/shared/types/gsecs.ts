export type GsecSecurity = {
  tradingsymbol: string;
  isin: string;
  coupon: number;
  maturityYear: number;
};

export type GsecCatalogSnapshot = {
  securities: (GsecSecurity & { instrumentToken: number })[];
  fetchedAt: string;
  day: string;
};

export type GsecSellerLevel = {
  price: number;
  quantity: number;
  orders: number;
};

export type GsecRow = GsecSecurity & {
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
  streamStatus: 'live' | 'disconnected' | 'error';
  message?: string;
};

export type GsecDepth = {
  tradingsymbol: string;
  sell: GsecSellerLevel[];
  fetchedAt: string;
};
