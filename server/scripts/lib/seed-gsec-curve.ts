import type { db } from '@server/db';
import { gsecCurveSeedStateTable, gsecCurveSnapshotsTable } from '@server/db/schema';
import { parseBondDate } from '@server/lib/calculators/gsec-cash-flows';
import { getGsecCurveConfig, type GsecCurveConfig } from '@server/lib/gsec-curve-config';
import { gsecCurveSnapshotSchema, nssParametersSchema } from '@shared/schemas/gsec-curve';
import type { GsecCurveSnapshot, NssParameters } from '@shared/types/gsec-curve';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

export const CCIL_NSS_URL = 'https://www.ccilindia.com/zcyc-parameters';
type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type GsecCurveSeed = {
  day: string;
  attemptedAt: string;
  snapshot: GsecCurveSnapshot | null;
  error: string | null;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

// Parse only the named, server-rendered table. Schema changes fail visibly.
function cellText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&(?:szlig|#223|#x00df);/gi, 'ß')
    .replace(/&(?:beta|#946|#x03b2);/gi, 'β')
    .trim();
}

function parseCcilReferenceDate(value: string): string | null {
  const iso = /^(\d{4}-\d{2}-\d{2})(?: 00:00:00(?:\.0)?)?$/.exec(value)?.[1];
  const indian = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  const date = iso ?? (indian ? `${indian[3]}-${indian[2]}-${indian[1]}` : null);
  return date && parseBondDate(date) ? date : null;
}

export function parseCcilNssHtml(html: string): { referenceDate: string; parameters: NssParameters }[] {
  const tables = [...html.matchAll(/<table\b[^>]*\bid\s*=\s*["']advancedSearch["'][^>]*>([\s\S]*?)<\/table\s*>/gi)];
  if (tables.length !== 1) throw new Error('CCIL NSS parameter table missing or ambiguous');
  const table = tables[0]![1]!;
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi)].map((match) =>
    cellText(match[1]!).toLowerCase().replace(/[ßβ]/g, 'beta').replace(/\s/g, '')
  );
  if (headers.join(',') !== 'date,beta0,beta1,beta2,beta3,tau1,tau2')
    throw new Error('CCIL NSS table headers have changed');
  const rows: { referenceDate: string; parameters: NssParameters }[] = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells = [...match[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map((cell) => cellText(cell[1]!));
    if (!cells.length) continue;
    const referenceDate = parseCcilReferenceDate(cells[0]!);
    if (cells.length !== 7 || !referenceDate) throw new Error('Invalid CCIL NSS table row');
    const numbers = cells.slice(1).map((cell) => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(cell)) throw new Error('Invalid CCIL NSS parameter');
      return Number(cell);
    });
    const parameters = nssParametersSchema.parse(
      Object.fromEntries(
        ['beta0', 'beta1', 'beta2', 'beta3', 'tau1', 'tau2'].map((name, index) => [name, numbers[index]])
      )
    );
    // Full snapshot validation also validates real calendar dates.
    const previous = rows.find((row) => row.referenceDate === referenceDate);
    if (previous && JSON.stringify(previous.parameters) !== JSON.stringify(parameters))
      throw new Error('Conflicting CCIL NSS parameters for one reference date');
    if (!previous) rows.push({ referenceDate, parameters });
  }
  if (!rows.length) throw new Error('CCIL NSS parameter table is empty');
  return rows.sort((a, b) => b.referenceDate.localeCompare(a.referenceDate));
}

export function createCcilCurveSnapshot(
  html: string,
  retrievedAt: string,
  config: GsecCurveConfig = getGsecCurveConfig()
): GsecCurveSnapshot {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(retrievedAt));
  const rows = parseCcilNssHtml(html);
  if (rows.some((row) => row.referenceDate > day)) throw new Error('CCIL returned a future-dated curve');
  const latest = rows[0]!;
  const definition = {
    provider: 'CCIL' as const,
    ...latest,
    sourceUrl: CCIL_NSS_URL,
    method: 'NSS' as const,
    compounding: config.GSEC_CURVE_COMPOUNDING,
    dayCount: config.GSEC_CURVE_DAY_COUNT,
    conventionSource:
      config.GSEC_CURVE_DAY_COUNT === 'ACT/365' && config.GSEC_CURVE_COMPOUNDING === 'continuous'
        ? 'App convention approved from GSec_Curve_Resolution_Tech_Spec.pdf; configurable via environment'
        : 'Explicit operator environment configuration; provider conventions not verified',
    minTenor: 0,
    maxTenor: 50,
  };
  return gsecCurveSnapshotSchema.parse({
    ...definition,
    id: hash(JSON.stringify(definition)),
    sourceHash: hash(html),
    publicationTimestamp: null,
    firstObservedAt: retrievedAt,
    retrievedAt,
  });
}

/** Failure does not abort the independent instrument/pledgeable-security seed. */
export async function fetchGsecCurveSeed(config: GsecCurveConfig = getGsecCurveConfig()): Promise<GsecCurveSeed> {
  const attemptedAt = new Date().toISOString();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(attemptedAt));
  try {
    const response = await fetch(CCIL_NSS_URL, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`CCIL NSS request failed (${response.status})`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('CCIL NSS response is not HTML');
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('CCIL NSS response is unexpectedly large');
    return { day, attemptedAt, snapshot: createCcilCurveSnapshot(html, new Date().toISOString(), config), error: null };
  } catch (error) {
    return { day, attemptedAt, snapshot: null, error: error instanceof Error ? error.message : 'CCIL import failed' };
  }
}

export async function storeGsecCurveSeed(tx: SeedTransaction, seed: GsecCurveSeed) {
  if (seed.snapshot) {
    const snapshot = gsecCurveSnapshotSchema.parse(seed.snapshot);
    const [existing] = await tx
      .select()
      .from(gsecCurveSnapshotsTable)
      .where(eq(gsecCurveSnapshotsTable.id, snapshot.id));
    // Repeated retrieval must not move the first-observed availability time.
    const previous = existing ? gsecCurveSnapshotSchema.parse(JSON.parse(existing.payload)) : null;
    const stored = gsecCurveSnapshotSchema.parse({
      ...snapshot,
      firstObservedAt: previous?.firstObservedAt ?? snapshot.firstObservedAt,
    });
    if (existing)
      await tx
        .update(gsecCurveSnapshotsTable)
        .set({ availableFrom: stored.publicationTimestamp ?? stored.firstObservedAt, payload: JSON.stringify(stored) })
        .where(eq(gsecCurveSnapshotsTable.id, snapshot.id));
    else
      await tx.insert(gsecCurveSnapshotsTable).values({
        id: stored.id,
        referenceDate: stored.referenceDate,
        availableFrom: stored.publicationTimestamp ?? stored.firstObservedAt,
        payload: JSON.stringify(stored),
      });
  }
  await tx.delete(gsecCurveSeedStateTable);
  await tx
    .insert(gsecCurveSeedStateTable)
    .values({ id: 1, seededDate: seed.day, attemptedAt: seed.attemptedAt, error: seed.error });
}
