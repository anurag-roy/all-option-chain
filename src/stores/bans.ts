import { BannedStock } from '@/types';
import { create } from 'zustand';

interface BansState {
  bannedStocks: BannedStock[];
  setBannedStocks: (stockNames: BannedStock[]) => void;
  toggleBannedStock: (stockName: string) => void;
}

export const useBansStore = create<BansState>((set) => ({
  bannedStocks: [],
  setBannedStocks: (stocks) => set({ bannedStocks: stocks }),
  toggleBannedStock: (stockName) =>
    set((state) => {
      const bannedStocks = state.bannedStocks;
      const stockIndex = bannedStocks.findIndex((stock) => stock.name === stockName);
      if (stockIndex === -1) {
        return { bannedStocks: [...bannedStocks, { name: stockName, type: 'custom' }] };
      } else {
        return { bannedStocks: bannedStocks.filter((stock) => stock.name !== stockName) };
      }
    }),
}));
