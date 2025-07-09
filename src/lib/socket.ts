import env from '@/env.json';
import { Instrument, UiInstrument } from '@/types';
import type { TouchlineResponse } from '@/types/shoonya';
import { workingDaysCache } from './workingDaysCache';
import { RISK_FREE_RATE } from '@/config';
import { WebSocket, type MessageEvent } from 'ws';

// Normal distribution cumulative density function
const normalCDF = (x: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
};

// Calculate Black-Scholes Delta
const calculateDelta = (
  underlyingPrice: number,
  strikePrice: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate: number,
  optionType: 'CE' | 'PE'
): number => {
  if (timeToExpiry <= 0 || volatility <= 0 || underlyingPrice <= 0 || strikePrice <= 0) {
    return 0;
  }

  // Convert volatility from percentage to decimal if needed
  const vol = volatility > 1 ? volatility / 100 : volatility;

  // Calculate d1
  const d1 =
    (Math.log(underlyingPrice / strikePrice) + (riskFreeRate + (vol * vol) / 2) * timeToExpiry) /
    (vol * Math.sqrt(timeToExpiry));

  // Calculate delta based on option type
  if (optionType === 'CE') {
    return normalCDF(d1);
  } else {
    return normalCDF(d1) - 1;
  }
};

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
  peFloorBound: number,
  ceCeilingBound: number
) =>
  new Promise<UiInstrument[]>((resolve) => {
    let responseReceived = 0;
    const validInstruments: UiInstrument[] = [];

    // New asymmetric sigma-based filtering logic
    // Get all available strikes for PUTs and CALLs
    const putStrikes = instruments
      .filter((s) => s.optionType === 'PE')
      .map((s) => s.strikePrice)
      .sort((a, b) => b - a); // Sort descending for PUTs

    const callStrikes = instruments
      .filter((s) => s.optionType === 'CE')
      .map((s) => s.strikePrice)
      .sort((a, b) => a - b); // Sort ascending for CALLs

    // Find closest floor strike to PE floor bound
    const closestFloorStrike = putStrikes.find((strike) => strike <= peFloorBound) || putStrikes[putStrikes.length - 1];

    // Find closest ceiling strike to CE ceiling bound
    const closestCeilingStrike =
      callStrikes.find((strike) => strike >= ceCeilingBound) || callStrikes[callStrikes.length - 1];

    console.log(
      `Asymmetric filtering: PE floor=${peFloorBound.toFixed(2)}, CE ceiling=${ceCeilingBound.toFixed(2)}, closestFloorStrike=${closestFloorStrike}, closestCeilingStrike=${closestCeilingStrike}`
    );

    // Filter instruments based on asymmetric logic
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

        // Calculate new sigma values using cached working days
        let sigmaN = 0;
        let sigmaX = 0;
        let sigmaXI = 0;
        let sd = 0; // Keep legacy SD for backward compatibility
        let delta = 0; // Delta calculation

        try {
          if (foundInstrument.av && foundInstrument.expiry) {
            // Calculate legacy SD for backward compatibility
            sd = await workingDaysCache.calculateSD(foundInstrument.av, foundInstrument.expiry);

            // Calculate new sigma values
            const sigmas = await workingDaysCache.calculateAllSigmas(
              foundInstrument.av,
              1, // Use base multiplier of 1 for individual instruments (multiplier applied at bounds level)
              foundInstrument.expiry,
              foundInstrument.optionType as 'CE' | 'PE'
            );

            sigmaN = sigmas.sigmaN;
            sigmaX = sigmas.sigmaX;
            sigmaXI = sigmas.sigmaXI;

            // Calculate delta using Black-Scholes
            const workingDaysTillExpiry = await workingDaysCache.getWorkingDaysTillExpiry(foundInstrument.expiry);
            const workingDaysInLastYear = await workingDaysCache.getWorkingDaysInLastYear();
            const T = workingDaysTillExpiry / workingDaysInLastYear;

            delta = calculateDelta(
              ltp, // underlying stock price
              foundInstrument.strikePrice,
              T,
              foundInstrument.av,
              RISK_FREE_RATE,
              foundInstrument.optionType as 'CE' | 'PE'
            );
          }
        } catch (error) {
          console.error(
            `Error calculating sigmas/delta for instrument ${foundInstrument.tradingSymbol} with expiry "${foundInstrument.expiry}":`,
            error
          );
          // Set all values to 0 if calculation fails
          sd = 0;
          sigmaN = 0;
          sigmaX = 0;
          sigmaXI = 0;
          delta = 0;
        }

        validInstruments.push({
          ...foundInstrument,
          ltp: ltp,
          bid: Number(messageData.bp1),
          sellValue,
          strikePosition,
          returnValue: 0,
          sd, // Legacy SD
          sigmaN,
          sigmaX,
          sigmaXI,
          delta, // Add delta to the UiInstrument
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
