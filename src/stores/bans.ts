import { create } from 'zustand';

interface BansState {
  bannedStocks: string[];
  setBannedStocks: (stockNames: string[]) => void;
  addBannedStock: (stockName: string) => void;
  removeBannedStock: (stockName: string) => void;
}

export const useBansStore = create<BansState>((set) => ({
  bannedStocks: [],
  setBannedStocks: (stockNames) => set({ bannedStocks: stockNames }),
  addBannedStock: (stockName) =>
    set((state) => {
      const bannedStocks = [...state.bannedStocks, stockName];
      return { bannedStocks };
    }),
  removeBannedStock: (stockName) =>
    set((state) => {
      const bannedStocks = state.bannedStocks.filter((stock) => stock !== stockName);
      return { bannedStocks };
    }),
}));
