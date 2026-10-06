import { createClient, type Client } from '@libsql/client';
import type { db } from '@server/db';
import { gsecSeedStateTable, gsecsTable, instrumentsTable } from '@server/db/schema';
import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import { replaceGsecSeed } from '@server/scripts/lib/seed-gsecs';
import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GsecCatalog } from './gsec-catalog';

// Each test injects its own temporary DB, without reading the app's env or DB.
vi.mock('@server/db', () => ({ db: null }));

const snapshot: GsecCatalogSnapshot = {
  securities: [
    {
      instrumentToken: 1,
      tradingsymbol: '75GS2034-GS',
      isin: 'IN0020040039',
      coupon: 750,
      maturityYear: 2034,
      maturityDate: '2034-08-10',
    },
  ],
  day: '2026-10-05',
  fetchedAt: '2026-10-05T05:00:00.000Z',
  tradeDate: '2026-10-05',
  settlementDate: '2026-10-06',
};
let directory: string;
let client: Client;
let database: typeof db;
let catalog: GsecCatalog;
async function seed(value = snapshot) {
  await database.transaction((tx) => replaceGsecSeed(tx, value));
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T05:00:00Z'));
  directory = mkdtempSync(join(tmpdir(), 'gsec-catalog-'));
  client = createClient({ url: `file:${join(directory, 'database.db')}` });
  database = drizzle(client, { casing: 'snake_case' });
  await migrate(database, { migrationsFolder: 'drizzle' });
  catalog = new GsecCatalog(database);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Runtime metadata fetch is forbidden');
    })
  );
});
afterEach(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('seeded G-Sec catalog', () => {
  it('loads and coalesces DB reads once per day without fetching external metadata', async () => {
    await seed();
    const reads = vi.spyOn(database, 'transaction');
    const [first, second] = await Promise.all([catalog.getSnapshot(), catalog.getSnapshot()]);
    expect(first).toEqual(snapshot);
    expect(first).toBe(second);
    vi.advanceTimersByTime(12 * 60 * 60_000);
    expect(await catalog.getSnapshot()).toBe(first);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the daily cache until restart even if the same day is reseeded', async () => {
    await seed();
    await catalog.getSnapshot();
    const updated = { ...snapshot, securities: [] };
    await seed(updated);
    expect(await catalog.getSnapshot()).toEqual(snapshot);
    expect(await new GsecCatalog(database).getSnapshot()).toEqual(updated);
  });

  it('rejects missing and stale seed data with preparation instructions, then loads the next seeded day', async () => {
    await expect(catalog.getSnapshot()).rejects.toBeInstanceOf(GsecSeedError);
    await expect(catalog.getSnapshot()).rejects.toThrow('npm run data:prepare');
    await seed();
    await catalog.getSnapshot();
    vi.setSystemTime(new Date('2026-10-05T18:31:00Z'));
    await expect(catalog.getSnapshot()).rejects.toThrow('seeded for 2026-10-05');
    const next = {
      ...snapshot,
      day: '2026-10-06',
      tradeDate: '2026-10-06',
      settlementDate: '2026-10-07',
      fetchedAt: '2026-10-05T18:31:00.000Z',
    };
    await seed(next);
    expect(await catalog.getSnapshot()).toEqual(next);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('replaces a previous list with a successfully seeded empty list', async () => {
    await seed();
    await seed({ ...snapshot, securities: [] });
    expect(await database.select().from(gsecsTable)).toEqual([]);
    expect(await catalog.getSnapshot()).toEqual({ ...snapshot, securities: [] });
    expect(await database.select().from(gsecSeedStateTable)).toHaveLength(1);
  });

  it('rolls back both instruments and G-Sec data if any part of the combined seed fails', async () => {
    await seed();
    await database
      .insert(instrumentsTable)
      .values({ instrumentToken: 99, exchangeToken: '99', tradingsymbol: 'TEST', name: 'TEST' });
    const broken = { ...snapshot, securities: [snapshot.securities[0]!, snapshot.securities[0]!] };
    await expect(
      database.transaction(async (tx) => {
        await tx.delete(instrumentsTable);
        await replaceGsecSeed(tx, broken);
      })
    ).rejects.toThrow();
    expect(await catalog.getSnapshot()).toEqual(snapshot);
    expect(await database.select().from(instrumentsTable)).toHaveLength(1);
  });

  it('shows migration instructions if the G-Sec tables have not been created yet', async () => {
    await client.execute('DROP TABLE gsec_seed_state');
    await expect(catalog.getSnapshot()).rejects.toThrow('npm run data:prepare');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires reseeding for pre-YTM rows or invalid settlement dates', async () => {
    await seed({ ...snapshot, settlementDate: '' });
    await expect(catalog.getSnapshot()).rejects.toThrow('bond terms or settlement dates are missing');
    await seed({ ...snapshot, securities: [{ ...snapshot.securities[0]!, maturityDate: '' }] });
    await expect(catalog.getSnapshot()).rejects.toThrow('npm run data:prepare');
  });
});
