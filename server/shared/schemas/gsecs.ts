import { z } from 'zod';

export const DEFAULT_GSEC_TARGET_YTM = 8;
export const gsecTargetYtmSchema = z.number().min(0).max(100);
