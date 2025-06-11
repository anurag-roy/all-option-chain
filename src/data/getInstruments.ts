import { NSE_STOCKS_TO_INCLUDE } from '@/config';
import { ShoonyaInstrument } from '@/types/shoonya';
import JSZip from 'jszip';

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
          dv: Number(cols[6]) * 100,
          av: Number(cols[7]) * 100,
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

export const getInstruments = async (forExchange: 'BSE' | 'NSE' | 'NFO') => {
  const txtFileName = forExchange + '_symbols.txt';
  const zipFileName = txtFileName + '.zip';

  const res = await fetch('https://api.shoonya.com/' + zipFileName);
  const arrayBuffer = await res.arrayBuffer();

  const jsZip = new JSZip();
  const result = await jsZip.loadAsync(arrayBuffer);
  const file = result.file(txtFileName);
  if (!file) {
    ('Did not find the expected .txt file. Exiting...');
    process.exit(1);
  }

  const output: ShoonyaInstrument[] = [];

  const fileContents = await file.async('text');
  const rows = fileContents.split('\n').slice(1);

  for (const row of rows) {
    if (forExchange === 'NSE' || forExchange === 'BSE') {
      const [exchange, token, lotSize, symbol, tradingSymbol, instrument, tickSize] = row.split(',');

      const validInstrumentType = forExchange === 'NSE' ? 'EQ' : 'B';
      if (instrument === validInstrumentType) {
        output.push({
          exchange,
          token,
          lotSize: Number(lotSize),
          symbol,
          tradingSymbol,
          expiry: '',
          instrument: 'EQ',
          optionType: 'XX',
          strikePrice: 0,
          tickSize,
        });
      }
    } else if (forExchange === 'NFO') {
      const [exchange, token, lotSize, symbol, tradingSymbol, expiry, instrument, optionType, strikePrice, tickSize] =
        row.split(',');

      if ((optionType === 'CE' || optionType === 'PE') && NSE_STOCKS_TO_INCLUDE.includes(symbol)) {
        output.push({
          exchange,
          token,
          lotSize: Number(lotSize),
          symbol,
          tradingSymbol,
          expiry,
          instrument,
          optionType,
          strikePrice: Number(strikePrice),
          tickSize,
        });
      }
    }
  }

  return output;
};
