import { z } from 'zod';

export const DEFAULT_GSEC_TARGET_YTM = 8;
export const gsecTargetYtmSchema = z.number().min(0).max(100);

export const DEFAULT_GSEC_SCENARIO_BASE = 0;
export const gsecScenarioBaseSchema = z.number().refine((base) => Number.isFinite((base + 5) * 32));
