import { db } from '@server/db';
import { gsecCurveSeedStateTable, gsecCurveSnapshotsTable } from '@server/db/schema';
import { getGsecCurveConfig, type GsecCurveConfig } from '@server/lib/gsec-curve-config';
import { gsecCurveSnapshotSchema } from '@shared/schemas/gsec-curve';
import type { GsecCurveSnapshot, GsecCurveState } from '@shared/types/gsec-curve';
import { desc, eq, sql } from 'drizzle-orm';

export class GsecCurveCatalog {
  private cached: { day: string; snapshots: GsecCurveSnapshot[]; error: string | null } | null = null;
  private pending: Promise<NonNullable<GsecCurveCatalog['cached']>> | null = null;
  private database: typeof db;
  private config: GsecCurveConfig;

  constructor(database: typeof db = db, config: GsecCurveConfig = getGsecCurveConfig()) {
    this.database = database;
    this.config = config;
  }

  async getSnapshot(asOf = new Date()): Promise<GsecCurveState> {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(asOf);
    try {
      if (this.cached?.day !== day) {
        this.pending ??= this.load(day).finally(() => {
          this.pending = null;
        });
        this.cached = await this.pending;
      }
      const candidates = this.cached.snapshots.filter(
        (snapshot) =>
          snapshot.referenceDate <= day &&
          Date.parse(snapshot.publicationTimestamp ?? snapshot.firstObservedAt) <= +asOf
      );
      const snapshot = candidates[0] ?? null;
      if (!snapshot)
        return {
          status: 'unavailable',
          snapshot: null,
          ageDays: null,
          rvThresholdBp: this.config.GSEC_RV_THRESHOLD_BP,
          message:
            this.cached.error ?? 'CCIL curve has not been seeded. Run npm run data:prepare, then restart the app.',
        };
      const ageDays = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${snapshot.referenceDate}T00:00:00Z`)) / 86_400_000;
      const conventionMatches =
        snapshot.dayCount === this.config.GSEC_CURVE_DAY_COUNT &&
        snapshot.compounding === this.config.GSEC_CURVE_COMPOUNDING;
      return {
        status: !conventionMatches ? 'unavailable' : ageDays > this.config.GSEC_CURVE_MAX_AGE_DAYS ? 'stale' : 'ready',
        snapshot,
        ageDays,
        rvThresholdBp: this.config.GSEC_RV_THRESHOLD_BP,
        message: !conventionMatches
          ? 'Curve convention changed. Run npm run data:prepare, then restart the app.'
          : ageDays > this.config.GSEC_CURVE_MAX_AGE_DAYS
            ? `CCIL curve is ${ageDays} days old; maximum age is ${this.config.GSEC_CURVE_MAX_AGE_DAYS} calendar days.`
            : this.cached.error
              ? `Latest CCIL import failed: ${this.cached.error}. Using the stored dated curve.`
              : undefined,
      };
    } catch {
      return {
        status: 'unavailable',
        snapshot: null,
        ageDays: null,
        rvThresholdBp: this.config.GSEC_RV_THRESHOLD_BP,
        message: 'Could not read CCIL curve data. Run npm run data:prepare, then restart the app.',
      };
    }
  }

  private async load(day: string) {
    // One SELECT sees snapshots and their import status consistently. Drizzle's
    // libSQL transaction API opens a write transaction even for pure reads.
    const rows = await this.database
      .select({
        id: gsecCurveSnapshotsTable.id,
        referenceDate: gsecCurveSnapshotsTable.referenceDate,
        availableFrom: gsecCurveSnapshotsTable.availableFrom,
        payload: gsecCurveSnapshotsTable.payload,
        error: gsecCurveSeedStateTable.error,
      })
      .from(gsecCurveSeedStateTable)
      .leftJoin(gsecCurveSnapshotsTable, sql`1 = 1`)
      .where(eq(gsecCurveSeedStateTable.id, 1))
      .orderBy(desc(gsecCurveSnapshotsTable.referenceDate), desc(gsecCurveSnapshotsTable.availableFrom))
      .limit(90);
    const snapshots = rows.flatMap((row) => {
      if (row.payload === null) return [];
      const snapshot = gsecCurveSnapshotSchema.parse(JSON.parse(row.payload));
      if (
        snapshot.id !== row.id ||
        snapshot.referenceDate !== row.referenceDate ||
        (snapshot.publicationTimestamp ?? snapshot.firstObservedAt) !== row.availableFrom
      )
        throw new Error('Inconsistent curve snapshot metadata');
      return [snapshot];
    });
    return { day, snapshots, error: rows[0]?.error ?? null };
  }
}

const gsecCurveCatalog = new GsecCurveCatalog();
export const getSeededGsecCurve = () => gsecCurveCatalog.getSnapshot();
