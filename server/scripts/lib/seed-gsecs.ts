import type { db } from '@server/db';
import { gsecSeedStateTable, gsecsTable } from '@server/db/schema';
import { APPROVED_SECURITIES_FEED, selectApprovedGsecs } from '@server/lib/services/approved-gsecs';
import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { chunk } from 'es-toolkit';
import type { Instrument } from 'kiteconnect-ts';

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function fetchGsecSeed(
  nseInstruments: Pick<Instrument, 'exchange' | 'tradingsymbol' | 'instrument_token'>[]
): Promise<GsecCatalogSnapshot> {
  const response = await fetch(APPROVED_SECURITIES_FEED, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Approved securities request failed (${response.status})`);
  const approved = selectApprovedGsecs(await response.json());
  const tokens = new Map(
    nseInstruments
      .filter((instrument) => instrument.exchange === 'NSE')
      .map((instrument) => [instrument.tradingsymbol, Number(instrument.instrument_token)])
  );
  const securities = approved.map((security) => {
    const instrumentToken = tokens.get(security.tradingsymbol);
    if (!instrumentToken || !Number.isSafeInteger(instrumentToken) || instrumentToken <= 0) {
      throw new Error(
        `Approved G-Sec ${security.tradingsymbol} is missing a valid NSE instrument token. G-Sec seed aborted.`
      );
    }
    return { ...security, instrumentToken };
  });
  const now = new Date();
  return {
    securities,
    fetchedAt: now.toISOString(),
    day: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now),
  };
}

// The caller also replaces equity/option instruments in this transaction.
export async function replaceGsecSeed(tx: SeedTransaction, snapshot: GsecCatalogSnapshot) {
  await tx.delete(gsecsTable);
  for (const securities of chunk(snapshot.securities, 500)) await tx.insert(gsecsTable).values(securities);
  await tx.delete(gsecSeedStateTable);
  await tx.insert(gsecSeedStateTable).values({ id: 1, seededDate: snapshot.day, fetchedAt: snapshot.fetchedAt });
}
