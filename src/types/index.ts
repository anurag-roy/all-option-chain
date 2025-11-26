import type { instrumentsTable } from '@/db/schema';
import type { WebSocket } from 'ws';

declare global {
  var ticker: WebSocket | null;
}

export type Instrument = typeof instrumentsTable.$inferSelect;

export type UiInstrument = Instrument & {
  ltp: number;
  bid: number;
  returnValue: number;
  strikePosition: number;
  sellValue: number;
  sd?: number; // Standard Deviation calculation (legacy)
  // New sigma calculations
  sigmaN?: number; // σₙ = sdMultiplier * Annual Volatility
  sigmaX?: number; // σₓ = σₙ / sqrt(T/N) - Error Deviation
  sigmaXI?: number; // σₓᵢ = σₙ ± σₓ - Confidence Deviation (different for CE/PE)
  // Black-Scholes calculations
  delta?: number; // Delta value for option pricing
  // UI variables to store increase/decrease from previous values
  ltpChange?: number;
  returnValueChange?: number;
  strikePositionChange?: number;
  gainLossPercent?: number;
};

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
