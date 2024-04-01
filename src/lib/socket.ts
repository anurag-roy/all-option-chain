import env from '@/env.json';
import { UiInstrument } from '@/types';
import type { TouchlineResponse } from '@/types/shoonya';
import type { instrument } from '@prisma/client';
import { WebSocket, type MessageEvent } from 'ws';

export const getNewTicker = async () =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket('wss://api.shoonya.com/NorenWSTP/');

    const timeout = setTimeout(() => {
      ws.close();
      reject('Connection timed out. Failed to connect ticker.');
    }, 3000);

    ws.onerror = (error) => {
      reject('Ticker error:' + error);
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          t: 'c',
          uid: env.USER_ID,
          actid: env.USER_ID,
          susertoken: process.env.token,
          source: 'API',
        })
      );
    };

    ws.onmessage = (messageEvent: MessageEvent) => {
      const messageData = JSON.parse(messageEvent.data as string);
      if (messageData.t === 'ck' && messageData.s === 'OK') {
        console.log(`Ticker connected successfully!`);
        clearTimeout(timeout);
        ws.onerror = null;
        resolve(ws);
      }
    };
  });

export const getValidInstruments = async (
  ws: WebSocket,
  instruments: instrument[],
  ltp: number,
  lowerBound: number,
  upperBound: number
) =>
  new Promise<UiInstrument[]>((resolve) => {
    let responseReceived = 0;
    const validInstruments: UiInstrument[] = [];

    const filteredInstruments = instruments.filter(
      (s) =>
        (s.strikePrice <= lowerBound && s.optionType === 'PE') || (s.strikePrice >= upperBound && s.optionType === 'CE')
    );
    const tokensToSubscribe = filteredInstruments.map((s) => `NFO|${s.token}`).join('#');

    // Timeout after 3 seconds, because sometimes Shoonya doesn't return an acknowledgement
    const timeout = setTimeout(() => {
      ws.send(
        JSON.stringify({
          t: 'u',
          k: tokensToSubscribe,
        })
      );
      resolve(validInstruments);
    }, 3000);

    ws.onmessage = (messageEvent: MessageEvent) => {
      const messageData = JSON.parse(messageEvent.data as string) as TouchlineResponse;

      if (messageData.t === 'tk' && 'oi' in messageData && messageData.bp1) {
        const foundInstrument = instruments.find((i) => i.token === messageData.tk)!;
        const sellValue = (Number(messageData.bp1) - 0.05) * foundInstrument.lotSize;
        const strikePosition = (Math.abs(foundInstrument.strikePrice - ltp) * 100) / ltp;
        validInstruments.push({
          ...foundInstrument,
          ltp: ltp,
          bid: Number(messageData.bp1),
          sellValue,
          strikePosition,
          returnValue: 0,
        });
      }

      responseReceived++;
      // If all responses received, resolve
      if (responseReceived === filteredInstruments.length) {
        ws.send(
          JSON.stringify({
            t: 'u',
            k: tokensToSubscribe,
          })
        );
        clearTimeout(timeout);
        resolve(validInstruments);
      }
    };

    ws.send(
      JSON.stringify({
        t: 't',
        k: tokensToSubscribe,
      })
    );
  });
