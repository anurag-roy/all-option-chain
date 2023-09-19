import { UiEquity } from '@/types';
import { create } from 'zustand';

interface EquityState {
  equities: UiEquity[];
  addEquities: (equities: UiEquity[]) => void;
  updateLtp: (stockName: string, ltp: number) => void;
  resetEquities: () => void;
}

export const useEquityStore = create<EquityState>((set) => ({
  equities: [],
  addEquities: (equitiesToAdd) =>
    set((state) => {
      const equities = [...state.equities, ...equitiesToAdd];
      return { equities };
    }),
  resetEquities: () => set({ equities: [] }),
  updateLtp: (stockName: string, ltp: number) =>
    set((state) => {
      const equities = state.equities.map((equity) => {
        if (equity.symbol === stockName) {
          const newGainLossPercent =
            ((ltp - equity.prevClose) * 100) / equity.prevClose;
          return {
            ...equity,
            ltp,
            gainLossPercent: newGainLossPercent,
          };
        }
        return equity;
      });
      return { equities };
    }),
}));
