import env from '@/env.json';
import { Instrument, UiInstrument } from '@/types';
import type { TouchlineResponse } from '@/types/shoonya';
import { workingDaysCache } from './workingDaysCache';
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
  instruments: Instrument[],
  ltp: number,
  minusSD: number,
  plusSD: number
) =>
  new Promise<UiInstrument[]>((resolve) => {
    let responseReceived = 0;
    const validInstruments: UiInstrument[] = [];

    // New SD-based filtering logic
    // Get all available strikes for PUTs and CALLs
    const putStrikes = instruments
      .filter((s) => s.optionType === 'PE')
      .map((s) => s.strikePrice)
      .sort((a, b) => b - a); // Sort descending for PUTs

    const callStrikes = instruments
      .filter((s) => s.optionType === 'CE')
      .map((s) => s.strikePrice)
      .sort((a, b) => a - b); // Sort ascending for CALLs

    // Find closest floor strike to minusSD value
    const closestFloorStrike = putStrikes.find((strike) => strike <= minusSD) || putStrikes[putStrikes.length - 1];

    // Find closest ceiling strike to plusSD value
    const closestCeilingStrike = callStrikes.find((strike) => strike >= plusSD) || callStrikes[callStrikes.length - 1];

    console.log(
      `Filtering logic: minusSD=${minusSD}, plusSD=${plusSD}, closestFloorStrike=${closestFloorStrike}, closestCeilingStrike=${closestCeilingStrike}`
    );

    // Filter instruments based on the new logic
    const filteredInstruments = instruments.filter((s) => {
      if (s.optionType === 'PE') {
        // Get all PUTs with strikes below (and including) the closest floor strike
        return s.strikePrice <= closestFloorStrike;
      } else if (s.optionType === 'CE') {
        // Get all CALLs with strikes above (and including) the closest ceiling strike
        return s.strikePrice >= closestCeilingStrike;
      }
      return false;
    });

    console.log(`Filtered ${filteredInstruments.length} instruments out of ${instruments.length} total`);

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

    ws.onmessage = async (messageEvent: MessageEvent) => {
      const messageData = JSON.parse(messageEvent.data as string) as TouchlineResponse;

      if (messageData.t === 'tk' && 'oi' in messageData && messageData.bp1) {
        const foundInstrument = instruments.find((i) => i.token === messageData.tk)!;
        const sellValue = (Number(messageData.bp1) - 0.05) * foundInstrument.lotSize;
        const strikePosition = (Math.abs(foundInstrument.strikePrice - ltp) * 100) / ltp;

        // Calculate SD using cached working days
        let sd = 0;
        try {
          if (foundInstrument.av && foundInstrument.expiry) {
            sd = await workingDaysCache.calculateSD(foundInstrument.av, foundInstrument.expiry);
          }
        } catch (error) {
          console.error(
            `Error calculating SD for instrument ${foundInstrument.tradingSymbol} with expiry "${foundInstrument.expiry}":`,
            error
          );
          // Set SD to 0 if calculation fails
          sd = 0;
        }

        validInstruments.push({
          ...foundInstrument,
          ltp: ltp,
          bid: Number(messageData.bp1),
          sellValue,
          strikePosition,
          returnValue: 0,
          sd,
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
