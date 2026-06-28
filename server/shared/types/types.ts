export type OptionType = 'CE' | 'PE';

export type MarginStatus = 'loading' | 'ready' | 'error' | 'unavailable';

export type ChainStatus = 'idle' | 'warming' | 'fetching_quotes' | 'subscribing' | 'ready' | 'error';

export type OptionChainRow = {
  instrumentToken: number;
  tradingsymbol: string;
  name: string;
  expiry: string;
  strike: number;
  instrumentType: OptionType;
  lotSize: number;
  tickSize: number;
  av: number;
  dv: number;
  underlyingLtp: number;
  bid: number;
  sellValue: number;
  strikePosition: number;
  orderMargin: number;
  returnValue: number;
  sd: number;
  sigmaN: number;
  sigmaX: number;
  sigmaXI: number;
  delta: number;
  oi: number;
  marginStatus: MarginStatus;
  gainLossPercent?: number;
  strikePositionChange?: number;
};

export type OptionChain = OptionChainRow;

export type OptionChainData = Record<number, OptionChainRow>;

export type EquitySnapshot = {
  token: number;
  symbol: string;
  ltp: number;
  prevClose: number;
  gainLossPercent: number;
};

export type ChainEngineStatus = {
  status: ChainStatus;
  message?: string;
  filter: {
    expiry: string;
    sdMultiplier: number;
    entryValue: number;
    orderPercent: number;
  } | null;
  subscribedTokenCount: number;
  rowCount: number;
  visibleRowCount: number;
  hasAccessToken: boolean;
};
