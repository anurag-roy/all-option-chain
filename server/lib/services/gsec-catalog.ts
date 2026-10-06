import { db } from '@server/db';
import { gsecSeedStateTable, gsecsTable } from '@server/db/schema';
import { parseBondDate } from '@server/lib/calculators/gsec-ytm';
import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import type { GsecCatalogSnapshot } from '@shared/types/gsecs';
import { eq } from 'drizzle-orm';

export class GsecCatalog {
  private cached: GsecCatalogSnapshot | null = null;
  private pending: Promise<GsecCatalogSnapshot> | null = null;
  private database: typeof db;

  constructor(database: typeof db = db) {
    this.database = database;
  }

  async getSnapshot(): Promise<GsecCatalogSnapshot> {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (this.cached?.day === day) return this.cached;
    if (!this.pending) {
      this.pending = this.load(day).finally(() => {
        this.pending = null;
      });
    }
    const snapshot = await this.pending;
    const currentDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return snapshot.day === currentDay ? snapshot : this.getSnapshot();
  }

  private async load(day: string): Promise<GsecCatalogSnapshot> {
    try {
      const snapshot = await this.database.transaction(async (tx) => {
        const [state] = await tx.select().from(gsecSeedStateTable).where(eq(gsecSeedStateTable.id, 1)).limit(1);
        if (!state)
          throw new GsecSeedError('G-Sec data has not been seeded. Run npm run data:prepare, then restart the app.');
        if (state.seededDate !== day) {
          throw new GsecSeedError(
            `G-Sec data was seeded for ${state.seededDate}. Run npm run data:prepare for today, then restart the app.`
          );
        }
        const securities = await tx.select().from(gsecsTable);
        if (
          !parseBondDate(state.tradeDate) ||
          !parseBondDate(state.settlementDate) ||
          state.tradeDate < day ||
          state.settlementDate <= state.tradeDate ||
          securities.some((security) => !parseBondDate(security.maturityDate))
        ) {
          throw new GsecSeedError(
            'G-Sec bond terms or settlement dates are missing. Run npm run data:prepare, then restart the app.'
          );
        }
        return {
          securities,
          day: state.seededDate,
          fetchedAt: state.fetchedAt,
          tradeDate: state.tradeDate,
          settlementDate: state.settlementDate,
        };
      });
      this.cached = snapshot;
      return snapshot;
    } catch (error) {
      if (error instanceof GsecSeedError) throw error;
      throw new GsecSeedError('Could not read seeded G-Sec data. Run npm run data:prepare, then restart the app.', {
        cause: error,
      });
    }
  }
}

const gsecCatalog = new GsecCatalog();
export const getSeededGsecs = () => gsecCatalog.getSnapshot();
