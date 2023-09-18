import { STOCKS_TO_INCLUDE } from '@/config';
import env from '@/env.json';
import type { UiInstrument } from '@/types';
import ky from 'ky';
import { create } from 'zustand';

interface InstrumentState {
  token: string | null;
  setToken: (token: string) => void;
  instruments: UiInstrument[];
  initInstruments: (expiry: string, entryPercent: number) => Promise<void>;
  socket: WebSocket | null;
  initSocket: () => void;
}

export const useInstrumentStore = create<InstrumentState>()((set) => ({
  token: null,
  setToken: (token) => set({ token }),
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
