import { NSE_STOCKS_TO_INCLUDE } from '@/config';
import type { ContractInstrument } from '@/types/piConnect';
import { parse } from 'date-fns';

/**
 * Flattrade scrip master location (CSV files).
 * Override this if you mirror the same file names in a private bucket.
 */
const FLATTRADE_SCRIPMASTER_BASE = (() => {
  const base =
    process.env.FLATTRADE_SCRIPMASTER_BASE?.trim() || 'https://flattrade.s3.ap-south-1.amazonaws.com/scripmaster/';
  return base.endsWith('/') ? base : `${base}/`;
})();

const SCRIPMASTER_FILES = {
  NSE: ['NSE_Equity.csv'],
  BSE: ['BSE_Equity.csv'],
  NFO: ['Nfo_Equity_Derivatives.csv', 'Nfo_Index_Derivatives.csv'],
} as const;

const DEFAULT_TICK_SIZE = '0.05';

type DailyReport = {
  name: string;
  type: string;
  category: string;
  section: string;
  link: string;
};

/**
 * NSE Session Manager for handling NSE API requests with proper session management
 */
class NSESessionManager {
  private sessionCookies: string = '';

  private getHeaders(includeCookies: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };

    if (includeCookies && this.sessionCookies) {
      headers['Cookie'] = this.sessionCookies;
      headers['Referer'] = 'https://www.nseindia.com/';
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    return headers;
  }

  /**
   * Establish session with NSE by visiting the main page
   */
  private async establishSession(): Promise<void> {
    try {
      const response = await fetch('https://www.nseindia.com/', {
        headers: this.getHeaders(),
      });

      // Extract cookies from response
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        this.sessionCookies = setCookieHeader;
      }
    } catch (error) {
      // Ignore session establishment errors
      console.warn('Session establishment failed, continuing anyway...');
    }
  }

  /**
   * Make authenticated request to NSE API
   */
  async makeRequest(url: string): Promise<Response> {
    // Establish session first
    await this.establishSession();

    // Make the API request with session cookies
    const response = await fetch(url, {
      headers: this.getHeaders(true),
    });

    // Update cookies if new ones are provided
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      this.sessionCookies = setCookieHeader;
    }

    return response;
  }
}

export const getVolatilityData = async () => {
  const sessionManager = new NSESessionManager();

  try {
    // First, get the daily reports list
    const dailyReportsRes = await sessionManager.makeRequest(
      'https://www.nseindia.com/api/merged-daily-reports?key=favCapital'
    );

    if (!dailyReportsRes.ok) {
      throw new Error(`Failed to fetch daily reports: ${dailyReportsRes.status} ${dailyReportsRes.statusText}`);
    }

    const dailyReportsData: DailyReport[] = await dailyReportsRes.json();

    const volatilityReport = dailyReportsData.find((report) => report.name === 'CM - Daily Volatility');
    if (!volatilityReport) {
      throw new Error('Volatility report not found');
    }

    const reportLink = volatilityReport.link;
    console.log('Fetching volatility data from', reportLink);

    // Fetch the actual volatility report
    const reportRes = await sessionManager.makeRequest(reportLink);

    if (!reportRes.ok) {
      throw new Error(`Failed to fetch volatility report: ${reportRes.status} ${reportRes.statusText}`);
    }

    const text = await reportRes.text();

    // The CSV file has the following columns:
    // Date,Symbol,Underlying Close Price (A),Underlying Previous Day Close Price (B),Underlying Log Returns (C) = LN(A/B),Previous Day Underlying Volatility (D),Current Day Underlying Daily Volatility (E) = Sqrt(0.995*D*D + 0.005*C*C),Underlying Annualised Volatility (F) = E*Sqrt(365)
    // 17-APR-2025,20MICRONS,218.40,206.21,0.0574,0.0329,0.0330,0.6305
    // 17-APR-2025,21STCENMGM,76.01,74.16,0.0246,0.0192,0.0193,0.3687
    // 17-APR-2025,360ONE,956.75,943.75,0.0137,0.0269,0.0268,0.5120

    const rows = text.split('\n').slice(1);
    return rows
      .filter((row) => row.trim()) // Filter out empty rows
      .map((row) => {
        const cols = row.split(',');
        return {
          symbol: cols[1],
          dv: Number(cols[6]),
          av: Number(cols[7]),
        };
      });
  } catch (error) {
    console.error('Error fetching volatility data:', error);
    throw error;
  }
};

export const getNifty500Stocks = async () => {
  const res = await fetch('https://archives.nseindia.com/content/indices/ind_nifty500list.csv');
  const text = await res.text();

  const rows = text.split('\n').slice(1);
  return rows.map((row) => row.split(',')[2]);
};

type ScripMasterRow = {
  exchange: string;
  token: string;
  lotSize: string;
  symbol: string;
  tradingSymbol: string;
  instrument: string;
  expiry: string;
  strike: string;
  optionType: string;
};

const parseScripMasterCsv = (fileContents: string): ScripMasterRow[] => {
  const rows = fileContents.split(/\r?\n/).slice(1);
  const output: ScripMasterRow[] = [];

  for (const row of rows) {
    if (!row.trim()) continue;

    const cols = row.split(',');
    if (cols.length < 9) continue;

    const [exchange, token, lotSize, symbol, tradingSymbol, instrument, expiry, strike, optionType] = cols.map((c) =>
      c.trim()
    );

    if (!exchange || !token || !symbol || !tradingSymbol) continue;
    output.push({
      exchange,
      token,
      lotSize,
      symbol,
      tradingSymbol,
      instrument,
      expiry,
      strike,
      optionType,
    });
  }

  return output;
};

const formatExpiry = (rawExpiry: string) => {
  const trimmed = rawExpiry.trim();
  if (!trimmed) return '';

  if (/^\d{2}-[A-Z]{3}-\d{4}$/.test(trimmed)) return trimmed;

  try {
    const parsedDate = parse(trimmed, 'dd-MMM-yyyy', new Date());
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .replace(/ /g, '-')
        .toUpperCase();
    }
  } catch {
    // Fall through to the unmodified value.
  }

  return trimmed;
};

export const getInstruments = async (forExchange: 'BSE' | 'NSE' | 'NFO') => {
  const fileNames = SCRIPMASTER_FILES[forExchange];
  const output: ContractInstrument[] = [];

  for (const fileName of fileNames) {
    const fileUrl = `${FLATTRADE_SCRIPMASTER_BASE}${fileName}`;
    const res = await fetch(fileUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch scrip master ${fileName}: ${res.status} ${res.statusText}`);
    }
    const fileContents = await res.text();
    const rows = parseScripMasterCsv(fileContents);

    for (const row of rows) {
      const lotSize = Number(row.lotSize);
      if (!Number.isFinite(lotSize) || lotSize <= 0) continue;

      if (forExchange === 'NSE' || forExchange === 'BSE') {
        const validInstrument = forExchange === 'NSE' ? 'EQ' : 'B';
        if (row.exchange !== forExchange || row.instrument !== validInstrument) continue;
        output.push({
          exchange: row.exchange,
          token: row.token,
          lotSize,
          symbol: row.symbol,
          tradingSymbol: row.tradingSymbol,
          expiry: '',
          instrument: row.instrument,
          optionType: 'XX',
          strikePrice: 0,
          tickSize: DEFAULT_TICK_SIZE,
        });
      } else if (forExchange === 'NFO') {
        if (row.exchange !== 'NFO') continue;
        if (row.optionType !== 'CE' && row.optionType !== 'PE') continue;
        if (!NSE_STOCKS_TO_INCLUDE.includes(row.symbol)) continue;

        const strikePrice = Number(row.strike);
        if (!Number.isFinite(strikePrice)) continue;

        output.push({
          exchange: row.exchange,
          token: row.token,
          lotSize,
          symbol: row.symbol,
          tradingSymbol: row.tradingSymbol,
          expiry: formatExpiry(row.expiry),
          instrument: row.instrument,
          optionType: row.optionType,
          strikePrice,
          tickSize: DEFAULT_TICK_SIZE,
        });
      }
    }
  }

  return output;
};
