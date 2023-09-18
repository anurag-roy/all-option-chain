import type { instrument } from '@prisma/client';

export interface UiInstrument extends instrument {
  ltp: number;
  bid: number;
  returnValue: number;
  strikePosition: number;
  sellValue: number;
}
