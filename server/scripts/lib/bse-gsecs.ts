import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { strFromU8, unzipSync } from 'fflate';
import { csv2json } from 'json-2-csv';
import type { Instrument } from 'kiteconnect-ts';

export const BSE_SECURITY_MASTER = 'https://www.bseindia.com/downloads/Help/file/SCRIP.zip';
export type GsecInstrument = Pick<
  Instrument,
  'exchange' | 'exchange_token' | 'tradingsymbol' | 'instrument_token' | 'tick_size'
>;
type SeedListing = GsecCatalogSnapshot['securities'][number];
const MAX_MASTER_BYTES = 20_000_000;
const fields = [
  'FinInstrmId',
  'TckrSymb',
  'SctySrs',
  'ISIN',
  'ParVal',
  'SctyTpFlg',
  'BidIntrvl',
  'Xchg',
  'Sts',
  'FinInstrmTp',
];

export function extractBseSecurityMaster(archive: Uint8Array): string {
  if (archive.byteLength > MAX_MASTER_BYTES) throw new Error('BSE security master archive is too large');
  const files = unzipSync(archive, {
    filter: (file) => {
      if (!/(?:^|\/)BSE_EQ_SCRIP_\d{8}\.csv$/.test(file.name)) return false;
      if (file.originalSize > MAX_MASTER_BYTES) throw new Error('BSE security master CSV is too large');
      return true;
    },
  });
  const masters = Object.values(files);
  if (masters.length !== 1) throw new Error('BSE archive must contain one dated equity security master CSV');
  return strFromU8(masters[0]!);
}

export function matchBseGsecs(nseListings: SeedListing[], instruments: GsecInstrument[], csv: string): SeedListing[] {
  const header = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/, 1)[0]
    ?.split(',')
    .map((field) => field.trim());
  for (const field of fields) {
    if (!header?.includes(field)) throw new Error(`BSE security master is missing ${field}`);
  }
  const rows = csv2json(csv.replace(/^\uFEFF/, ''), {
    trimHeaderFields: true,
    trimFieldValues: true,
    parseValue: (value) => value,
  }) as Record<string, string>[];
  if (!rows.some((row) => row.Xchg === 'BSE' && row.SctyTpFlg === 'GS')) {
    throw new Error('BSE security master contains no government securities');
  }
  const approved = new Map(nseListings.map((listing) => [listing.isin, listing]));
  const kite = new Map(
    instruments
      .filter((instrument) => instrument.exchange === 'BSE')
      .map((instrument) => [String(instrument.exchange_token), instrument])
  );
  const listings: SeedListing[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.Xchg !== 'BSE' || row.SctyTpFlg !== 'GS' || row.Sts !== 'A') continue;
    const terms = approved.get(row.ISIN!);
    const instrument = kite.get(row.FinInstrmId!);
    // An approved bond without an active, broker-available BSE counterpart is fine.
    if (!terms || !instrument) continue;
    if (row.SctySrs !== 'G' || row.FinInstrmTp !== 'D') {
      throw new Error(`Unsupported BSE quote convention for ${row.TckrSymb}: expected G-group dirty prices`);
    }
    const instrumentToken = Number(instrument.instrument_token);
    const tickSize = Number(instrument.tick_size);
    if (
      row.TckrSymb !== instrument.tradingsymbol ||
      !/^[A-Z0-9][A-Z0-9-]{0,49}$/.test(instrument.tradingsymbol) ||
      !Number.isSafeInteger(instrumentToken) ||
      instrumentToken <= 0 ||
      !Number.isSafeInteger(tickSize * 100) ||
      tickSize <= 0 ||
      tickSize !== Number(row.BidIntrvl) ||
      Number(row.ParVal) !== 10000
    ) {
      throw new Error(`Invalid or conflicting BSE listing for ${row.TckrSymb} (${row.ISIN})`);
    }
    if (seen.has(row.FinInstrmId!)) throw new Error(`Duplicate BSE listing for ${row.FinInstrmId}`);
    seen.add(row.FinInstrmId!);
    listings.push({ ...terms, exchange: 'BSE', tradingsymbol: instrument.tradingsymbol, instrumentToken, tickSize });
  }
  return listings;
}
