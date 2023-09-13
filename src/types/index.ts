import type { instrument } from '@prisma/client';

export interface UiInstrument extends instrument {
  bid: number;
  value: number;
  return: number;
}
