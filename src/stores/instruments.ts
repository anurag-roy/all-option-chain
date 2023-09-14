import { STOCKS_TO_INCLUDE } from '@/config';
import type { UiInstrument } from '@/types';
import ky from 'ky';
import { create } from 'zustand';

interface InstrumentState {
  instruments: UiInstrument[];
  initInstruments: (expiry: string, entryPercent: number) => Promise<void>;
}

export const useInstrumentStore = create<InstrumentState>()((set) => ({
  instruments: [],
  initInstruments: async (expiry, entryPercent) => {
    const instruments: UiInstrument[] = [];
    for (const stock of STOCKS_TO_INCLUDE) {
      console.log('Fetching valid instruments for', stock);
      const i = await ky
        .get('/api/validInstruments', {
          searchParams: {
            stock,
            expiry,
            entryPercent,
          },
        })
        .json<UiInstrument[]>();
      instruments.push(...i);
    }
    console.log('Instruments fetched for all stocks');
    return set({ instruments });
  },
}));
