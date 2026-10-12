import { createClient, type Client } from '@libsql/client';
import type { db } from '@server/db';
import { gsecCurveSnapshotsTable } from '@server/db/schema';
import { gsecCurveConfigSchema } from '@server/lib/gsec-curve-config';
import { GsecCurveCatalog } from '@server/lib/services/gsec-curve-catalog';
import { createCcilCurveSnapshot, storeGsecCurveSeed } from '@server/scripts/lib/seed-gsec-curve';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/db', () => ({ db: null }));
const config = gsecCurveConfigSchema.parse({});
const makeHtml = (date = '2026-10-08', beta0 = 8.27) =>
  `<table id="advancedSearch"><tr><th>Date</th><th>ß0</th><th>ß1</th><th>ß2</th><th>ß3</th><th>tau1</th><th>tau2</th></tr><tr><td>${date}</td><td>${beta0}</td><td>-2.9928</td><td>-19.9674</td><td>19.5976</td><td>2.0618</td><td>1.8925</td></tr></table>`;
const observedAt = '2026-10-09T02:00:00.000Z';
let client: Client;
let directory: string;
let database: typeof db;
let catalog: GsecCurveCatalog;
async function seed(date = '2026-10-08', at = observedAt, beta0 = 8.27) {
  const snapshot = createCcilCurveSnapshot(makeHtml(date, beta0), at, config);
  await database.transaction((tx) =>
    storeGsecCurveSeed(tx, { day: at.slice(0, 10), attemptedAt: at, snapshot, error: null })
  );
  return snapshot;
}
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'gsec-curve-catalog-'));
  client = createClient({ url: `file:${join(directory, 'database.db')}` });
  database = drizzle(client, { casing: 'snake_case' });
  await migrate(database, { migrationsFolder: 'drizzle' });
  catalog = new GsecCurveCatalog(database, config);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Runtime curve fetching is forbidden');
    })
  );
});
afterEach(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('stored dated curve snapshots', () => {
  it('uses previous-day curves and coalesces one read per IST day with no external request', async () => {
    const snapshot = await seed();
    const reads = vi.spyOn(database, 'select');
    const asOf = new Date('2026-10-09T03:00:00Z');
    const states = await Promise.all([catalog.getSnapshot(asOf), catalog.getSnapshot(asOf)]);
    expect(states[0]).toMatchObject({ status: 'ready', snapshot, ageDays: 1, rvThresholdBp: 5 });
    expect(reads).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reads committed curve data while another catalog holds a write-mode transaction', async () => {
    await seed();
    const transactions = vi.spyOn(database, 'transaction');
    await database.transaction(async (tx) => {
      await tx.select().from(gsecCurveSnapshotsTable);
      const state = await catalog.getSnapshot(new Date('2026-10-09T03:00:00Z'));
      expect(state.status).toBe('ready');
      expect(state.snapshot?.referenceDate).toBe('2026-10-08');
    });
    expect(transactions).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('accepts a Friday curve on Monday but disables data beyond the configured calendar age', async () => {
    await seed('2026-10-09', '2026-10-09T14:00:00.000Z');
    expect(await catalog.getSnapshot(new Date('2026-10-12T03:00:00Z'))).toMatchObject({ status: 'ready', ageDays: 3 });
    expect(await catalog.getSnapshot(new Date('2026-10-17T03:00:00Z'))).toMatchObject({ status: 'stale', ageDays: 8 });
  });
  it('preserves history, repeated first-observation time, and revised versions', async () => {
    const initial = await seed();
    const repeated = await seed('2026-10-08', '2026-10-09T04:00:00.000Z');
    expect(repeated.id).toBe(initial.id);
    const stored = await database.select().from(gsecCurveSnapshotsTable);
    expect(stored).toHaveLength(1);
    expect(JSON.parse(stored[0]!.payload)).toMatchObject({
      firstObservedAt: observedAt,
      retrievedAt: repeated.retrievedAt,
    });
    await seed('2026-10-08', '2026-10-09T05:00:00.000Z', 8.28);
    await seed('2026-10-09', '2026-10-09T14:00:00.000Z');
    expect(await database.select().from(gsecCurveSnapshotsTable)).toHaveLength(3);
    expect((await catalog.getSnapshot(new Date('2026-10-09T03:00:00Z'))).snapshot?.id).toBe(initial.id);
    expect((await catalog.getSnapshot(new Date('2026-10-09T06:00:00Z'))).snapshot?.parameters.beta0).toBe(8.28);
    expect((await catalog.getSnapshot(new Date('2026-10-09T15:00:00Z'))).snapshot?.referenceDate).toBe('2026-10-09');
  });
  it('does not backfill first-observed or evening data into earlier intraday valuations', async () => {
    await seed();
    expect(await catalog.getSnapshot(new Date('2026-10-09T01:00:00Z'))).toMatchObject({
      status: 'unavailable',
      snapshot: null,
    });
    expect((await catalog.getSnapshot(new Date('2026-10-09T02:00:00Z'))).snapshot?.referenceDate).toBe('2026-10-08');
  });
  it('retains a fresh stored curve on import failure and explains fallback', async () => {
    const previous = await seed();
    await database.transaction((tx) =>
      storeGsecCurveSeed(tx, {
        day: '2026-10-10',
        attemptedAt: '2026-10-10T02:00:00.000Z',
        snapshot: null,
        error: 'CCIL unavailable',
      })
    );
    expect(await catalog.getSnapshot(new Date('2026-10-10T03:00:00Z'))).toMatchObject({
      status: 'ready',
      snapshot: previous,
      ageDays: 2,
      message: expect.stringContaining('Using the stored dated curve'),
    });
  });
  it('requires reseeding when app conventions change and picks up same-day corrections after restart', async () => {
    await seed();
    await catalog.getSnapshot(new Date('2026-10-09T03:00:00Z'));
    await seed('2026-10-08', '2026-10-09T05:00:00.000Z', 8.28);
    expect((await catalog.getSnapshot(new Date('2026-10-09T06:00:00Z'))).snapshot?.parameters.beta0).toBe(8.27);
    expect(
      (await new GsecCurveCatalog(database, config).getSnapshot(new Date('2026-10-09T06:00:00Z'))).snapshot?.parameters
        .beta0
    ).toBe(8.28);
    expect(
      await new GsecCurveCatalog(database, { ...config, GSEC_CURVE_DAY_COUNT: 'ACT/360' }).getSnapshot(
        new Date('2026-10-09T06:00:00Z')
      )
    ).toMatchObject({ status: 'unavailable', message: expect.stringContaining('convention changed') });
  });
  it('handles missing migrations, absent seeds and corrupt payloads without losing standalone analytics', async () => {
    expect(await catalog.getSnapshot(new Date('2026-10-09T03:00:00Z'))).toMatchObject({ status: 'unavailable' });
    await seed();
    await database
      .insert(gsecCurveSnapshotsTable)
      .values({ id: 'broken', referenceDate: '2026-10-08', availableFrom: observedAt, payload: '{}' });
    expect(await new GsecCurveCatalog(database, config).getSnapshot(new Date('2026-10-09T03:00:00Z'))).toMatchObject({
      status: 'unavailable',
    });
    await client.execute('DROP TABLE gsec_curve_snapshots');
    expect(await new GsecCurveCatalog(database, config).getSnapshot(new Date('2026-10-09T03:00:00Z'))).toMatchObject({
      status: 'unavailable',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
