import { z } from 'zod';

export const gsecCurveConfigSchema = z.object({
  GSEC_CURVE_DAY_COUNT: z.enum(['ACT/365', 'ACT/360', '30E/360']).default('ACT/365'),
  GSEC_CURVE_COMPOUNDING: z.enum(['continuous', 'annual', 'semiannual']).default('continuous'),
  GSEC_CURVE_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(31).default(7),
  GSEC_RV_THRESHOLD_BP: z.coerce.number().min(0).max(1000).default(5),
});

export type GsecCurveConfig = z.infer<typeof gsecCurveConfigSchema>;
export const getGsecCurveConfig = () => gsecCurveConfigSchema.parse(process.env);
