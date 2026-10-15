import { z } from 'zod';

export const DEFAULT_GSEC_TARGET_YTM = 8;
export const gsecTargetYtmSchema = z.number().min(0).max(100);

export const DEFAULT_GSEC_SCENARIO_BASE = 0;
export const gsecScenarioBaseSchema = z.number().refine((base) => Number.isFinite((base + 5) * 32));

// At least one whole day after fractional months are converted; at most 100 years.
export const gsecCarryMonthsSchema = z
  .number()
  .min(1 / 60)
  .max(1200);
