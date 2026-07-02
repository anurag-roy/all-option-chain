import { z } from 'zod';

export const chainFilterSchema = z.object({
  expiry: z.string().min(1),
  sdMultiplier: z.number().min(0).max(10),
  entryValue: z.number().min(0),
  symbols: z.array(z.string()).optional(),
});

export type ChainFilter = z.infer<typeof chainFilterSchema>;
