import type { instrument } from '@prisma/client';
import type { WebSocket } from 'ws';

declare global {
  var ticker: WebSocket | null;
}

export interface UiInstrument extends instrument {
  ltp: number;
  bid: number;
  returnValue: number;
  strikePosition: number;
  sellValue: number;
  // UI variables to store increase/decrease from previous values
  ltpChange?: number;
  returnValueChange?: number;
  strikePositionChange?: number;
  gainLossPercent?: number;
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

export type BannedStock = {
  name: string;
  type: 'nse' | 'custom';
};
