import env from '@/env.json';
import type { UiInstrument } from '@/types';
import type { Margin, TouchlineResponse } from '@/types/shoonya';
import { create } from 'zustand';

interface InstrumentState {
  token: string | null;
  setToken: (token: string) => void;
  instruments: UiInstrument[];
  addInstruments: (instruments: UiInstrument[]) => void;
  updateBid: (socketResponse: TouchlineResponse) => void;
  updateLtp: (stockName: string, ltp: number) => void;
  updateReturn: (token: string, margin: Margin) => void;
  resetInstruments: () => void;
  socket: WebSocket | null;
  initSocket: () => void;
}

export const useInstrumentStore = create<InstrumentState>()((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  instruments: [],
  addInstruments: (instrumentsToAdd) =>
    set((state) => {
      const instruments = [...state.instruments, ...instrumentsToAdd];
      return { instruments };
    }),
  resetInstruments: () => set({ instruments: [] }),
  updateBid: (response) =>
    set((state) => {
      const instruments = state.instruments.map((instrument) => {
        if (instrument.token === response.tk) {
          const newBid = Number(response.bp1);
          const newSellValue = (newBid - 0.05) * instrument.lotSize;
          return {
            ...instrument,
            bid: newBid,
            sellValue: newSellValue,
          };
        }
        return instrument;
      });
      return { instruments };
    }),
  updateLtp: (stockName: string, ltp: number) =>
    set((state) => {
      const instruments = state.instruments.map((instrument) => {
        if (instrument.symbol === stockName) {
          const newStrikePosition =
            (Math.abs(instrument.strikePrice - ltp) * 100) / ltp;
          return {
            ...instrument,
            ltp,
            strikePosition: newStrikePosition,
          };
        }
        return instrument;
      });
      return { instruments };
    }),
  updateReturn: (token: string, margin: Margin) =>
    set((state) => {
      const instruments = state.instruments.map((i) => {
        if (i.token === token) {
          const newReturn =
            ((i.bid - 0.05) * i.lotSize * 100) / Number(margin.ordermargin);
          return {
            ...i,
            returnValue: newReturn,
          };
        }
        return i;
      });
      return { instruments };
    }),
  socket: null,
  initSocket: () =>
    set((state) => {
      const socket = new WebSocket('wss://api.shoonya.com/NorenWSTP/');

      socket.onerror = (error) => {
        console.log('Socket error:', error);
      };

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            t: 'c',
            uid: env.USER_ID,
            actid: env.USER_ID,
            susertoken: state.token,
            source: 'API',
          })
        );
      };

      socket.onmessage = (messageEvent) => {
        const messageData = JSON.parse(messageEvent.data as string);
        if (messageData.t === 'ck' && messageData.s === 'OK') {
          console.log('Socket connected successfully!');
          socket.onerror = null;
        }
      };

      return { socket };
    }),
}));
