import type { db } from '@server/db';
import { gsecSeedStateTable, gsecsTable } from '@server/db/schema';
import { APPROVED_SECURITIES_FEED, selectApprovedGsecs } from '@server/lib/services/approved-gsecs';
import {
  BSE_SECURITY_MASTER,
  extractBseSecurityMaster,
  matchBseGsecs,
  type GsecInstrument,
} from '@server/scripts/lib/bse-gsecs';
import { getGsecSettlementDates, parseGsecCalendar } from '@server/scripts/lib/gsec-settlement';
import { NSE_DEBT_MASTER, parseNseGsecTerms, resolveGsecTerms } from '@server/scripts/lib/gsec-terms';
import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { chunk } from 'es-toolkit';

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function fetchGsecSeed(
  nseInstruments: GsecInstrument[],
  bseInstruments: GsecInstrument[]
): Promise<GsecCatalogSnapshot> {
  const request = async (url: string) => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) throw new Error(`G-Sec seed request failed (${response.status}): ${url}`);
    return response;
  };
  const [approvedResponse, termsResponse, tradingResponse, clearingResponse, bseResponse] = await Promise.all([
    request(APPROVED_SECURITIES_FEED),
    request(NSE_DEBT_MASTER),
    request('https://www.nseindia.com/api/holiday-master?type=trading'),
    request('https://www.nseindia.com/api/holiday-master?type=clearing'),
    request(BSE_SECURITY_MASTER),
  ]);
  const approved = selectApprovedGsecs(await approvedResponse.json());
  const terms = parseNseGsecTerms(await termsResponse.text());
  const trading = parseGsecCalendar(await tradingResponse.json());
  const clearing = parseGsecCalendar(await clearingResponse.json());
  const tokens = new Map(
    nseInstruments
      .filter((instrument) => instrument.exchange === 'NSE')
      .map((instrument) => [instrument.tradingsymbol, instrument])
  );
  const nseListings = approved.map((security) => {
    const instrument = tokens.get(security.tradingsymbol);
    const instrumentToken = Number(instrument?.instrument_token);
    if (!instrumentToken || !Number.isSafeInteger(instrumentToken) || instrumentToken <= 0) {
      throw new Error(
        `Approved G-Sec ${security.tradingsymbol} is missing a valid NSE instrument token. G-Sec seed aborted.`
      );
    }
    const tickSize = Number(instrument?.tick_size);
    if (!Number.isSafeInteger(tickSize * 100) || tickSize <= 0) {
      throw new Error(`Approved G-Sec ${security.tradingsymbol} is missing a valid NSE tick size. G-Sec seed aborted.`);
    }
    return { ...resolveGsecTerms(security, terms), exchange: 'NSE' as const, instrumentToken, tickSize };
  });
  const bseMaster = extractBseSecurityMaster(new Uint8Array(await bseResponse.arrayBuffer()));
  const securities = [...nseListings, ...matchBseGsecs(nseListings, bseInstruments, bseMaster)];
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  return {
    securities,
    fetchedAt: now.toISOString(),
    day,
    ...getGsecSettlementDates(day, trading, clearing),
  };
}

// The caller also replaces equity/option instruments in this transaction.
export async function replaceGsecSeed(tx: SeedTransaction, snapshot: GsecCatalogSnapshot) {
  await tx.delete(gsecsTable);
  for (const securities of chunk(snapshot.securities, 500)) await tx.insert(gsecsTable).values(securities);
  await tx.delete(gsecSeedStateTable);
  await tx.insert(gsecSeedStateTable).values({
    id: 1,
    seededDate: snapshot.day,
    fetchedAt: snapshot.fetchedAt,
    tradeDate: snapshot.tradeDate,
    settlementDate: snapshot.settlementDate,
  });
}
