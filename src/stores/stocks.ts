import env from '@/env.json';
import { getReturnValue, playAlert } from '@/lib/utils';
import type { UiEquity, UiInstrument } from '@/types';
import type { Margin, TouchlineResponse } from '@/types/shoonya';
import { create } from 'zustand';

interface StockState {
  token: string | null;
  setToken: (token: string) => void;
  entryValue: number;
  setEntryValue: (entryValue: number) => void;
  orderPercent: number;
  setOrderPercent: (orderPercent: number) => void;
  sdMultiplier: number;
  setSdMultiplier: (sdMultiplier: number) => void;
  initComplete: boolean;
  setInitComplete: (initComplete: boolean) => void;
  equities: UiEquity[];
  addEquity: (equities: UiEquity) => void;
  updateLtp: (socketResponse: TouchlineResponse) => void;
  resetEquities: () => void;
  instruments: UiInstrument[];
  addInstruments: (instruments: UiInstrument[]) => void;
  updateBid: (socketResponse: TouchlineResponse) => void;
  updateReturn: (token: string, returnValue: number) => void;
  updateReturnFromMargin: (token: string, margin: Margin) => void;
  updateDelta: (token: string, delta: number) => void;
  resetInstruments: () => void;
  socket: WebSocket | null;
  initSocket: () => void;
}

export const useStockStore = create<StockState>()((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  entryValue: 0,
  setEntryValue: (entryValue) => set({ entryValue }),
  orderPercent: 0,
  setOrderPercent: (orderPercent) => set({ orderPercent }),
  sdMultiplier: 1,
  setSdMultiplier: (sdMultiplier) => set({ sdMultiplier }),
  initComplete: false,
  setInitComplete: (initComplete) => set({ initComplete }),
  equities: [],
  addEquity: (equityToAdd) =>
    set((state) => {
      const equities = [...state.equities, equityToAdd];
      return { equities };
    }),
  resetEquities: () => set({ equities: [] }),
  updateLtp: (data) =>
    set((state) => {
      let foundEquity = state.equities.find((equity) => equity.token === data.tk)!;
      if (!foundEquity) return {};

      const ltp = Number(data.lp);
      let gainLossPercent = 0;

      // Update equity LTP
      const equities = state.equities.map((equity) => {
        if (equity.token === data.tk) {
          foundEquity = equity;
          gainLossPercent = ((ltp - equity.prevClose) * 100) / equity.prevClose;
          return {
            ...equity,
            ltp,
            gainLossPercent: gainLossPercent,
          };
        }
        return equity;
      });

      // Update instruments LTP
      const instruments = state.instruments.map((instrument) => {
        if (instrument.symbol === foundEquity.symbol) {
          const newStrikePosition = (Math.abs(instrument.strikePrice - ltp) * 100) / ltp;

          // Trigger delta recalculation for this instrument
          if (instrument.av && instrument.expiry) {
            fetch('/api/delta', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ltp,
                strikePrice: instrument.strikePrice,
                expiry: instrument.expiry,
                av: instrument.av,
                optionType: instrument.optionType,
              }),
            })
              .then((res) => res.json())
              .then(({ delta }) => {
                // Update the instrument with new delta
                state.updateDelta(instrument.token, delta);
              })
              .catch((error) => {
                console.error(`Failed to calculate delta for ${instrument.tradingSymbol}:`, error);
              });
          }

          return {
            ...instrument,
            ltp,
            ltpChange: ltp - instrument.ltp || instrument.ltpChange,
            strikePosition: newStrikePosition,
            strikePositionChange: newStrikePosition - instrument.strikePosition || instrument.strikePositionChange,
            gainLossPercent: gainLossPercent,
          };
        }
        return instrument;
      });

      return { equities, instruments };
    }),
  instruments: [],
  addInstruments: (instrumentsToAdd) =>
    set((state) => {
      const instruments = [...state.instruments, ...instrumentsToAdd];
      return { instruments };
    }),
  resetInstruments: () => set({ instruments: [] }),
  updateBid: (data) =>
    set((state) => {
      const [firstInstrument] = state.instruments.toSorted((a, b) => b.returnValue - a.returnValue);
      if (firstInstrument.token === data.tk) {
        playAlert();
      }
      const instruments = state.instruments.map((instrument) => {
        if (instrument.token === data.tk) {
          const newBid = Number(data.bp1);
          const newSellValue = (newBid - 0.05) * instrument.lotSize;
          getReturnValue(instrument)
            .then(({ returnValue, isMarginAvailable }) => {
              state.updateReturn(instrument.token, returnValue);
            })
            .catch(() => {});
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
  updateReturn: (token, returnValue) =>
    set((state) => {
      const instruments = state.instruments.map((i) => {
        if (i.token === token) {
          return {
            ...i,
            returnValue,
            returnValueChange: returnValue - i.returnValue || i.returnValueChange,
          };
        }
        return i;
      });
      return { instruments };
    }),
  updateReturnFromMargin: (token: string, margin: Margin) =>
    set((state) => {
      const instruments = state.instruments.map((i) => {
        if (i.token === token) {
          const newReturn = ((i.bid - 0.05) * i.lotSize * 100) / Number(margin.ordermargin);
          return {
            ...i,
            returnValue: newReturn,
            returnValueChange: newReturn - i.returnValue || i.returnValueChange,
          };
        }
        return i;
      });
      return { instruments };
    }),
  updateDelta: (token: string, delta: number) =>
    set((state) => {
      const instruments = state.instruments.map((i) => {
        if (i.token === token) {
          return {
            ...i,
            delta,
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

      socket.onclose = (event) => {
        console.log('Socket closed!', event);
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

          socket.onmessage = (event) => {
            const messageData = JSON.parse(event.data as string);
            if (messageData.t !== 'tf') return;

            const data = messageData as TouchlineResponse;
            if (data.e === 'NSE' && 'lp' in data) {
              state.updateLtp(data);
            } else if (data.e === 'NFO' && 'bp1' in data) {
              console.log('Buyer price changed', data);
              state.updateBid(data);
            }
          };

          const tokensToSubscribe = [
            ...state.instruments.map((s) => `NFO|${s.token}`),
            ...state.equities.map((s) => `NSE|${s.token}`),
          ].join('#');
          socket.send(
            JSON.stringify({
              t: 't',
              k: tokensToSubscribe,
            })
          );
        }
      };
      return { socket };
    }),
}));
