import type { instrument } from '@prisma/client';

export interface UiInstrument extends instrument {
  ltp: number;
  bid: number;
  returnValue: number;
  strikePosition: number;
  sellValue: number;
}

export type UiEquity = {
  token: string;
  symbol: string;
  ltp: number;
  prevClose: number;
  gainLossPercent: number;
};

export type StockInitResponse = {
  equity: UiEquity;
  instruments: UiInstrument[];
};
