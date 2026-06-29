import { z } from 'zod';

export const bannedStockSchema = z.object({
  name: z.string(),
  type: z.enum(['nse', 'custom']),
});

export const toggleBanSchema = z.object({
  name: z.string().min(1),
});

export const bansResponseSchema = z.object({
  bans: z.array(bannedStockSchema),
  nseCount: z.number(),
  customCount: z.number(),
  totalCount: z.number(),
});

export type BannedStock = z.infer<typeof bannedStockSchema>;
export type BansResponse = z.infer<typeof bansResponseSchema>;
