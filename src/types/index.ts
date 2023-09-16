import type { instrument } from '@prisma/client';

export interface UiInstrument extends instrument {
  ltp: number;
  bid: number;
  value: number;
  return: number;
}
