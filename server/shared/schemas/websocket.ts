import { z } from 'zod';

export const wsSubscribeSchema = z.object({
  type: z.literal('subscribe'),
  symbols: z.array(z.string()),
});

export const wsUnsubscribeSchema = z.object({
  type: z.literal('unsubscribe'),
  symbols: z.array(z.string()),
});

export const wsUpdateFilterSchema = z.object({
  type: z.literal('updateFilter'),
  filter: z.object({
    expiry: z.string(),
    sdMultiplier: z.number(),
    entryValue: z.number(),
    orderPercent: z.number(),
    symbols: z.array(z.string()).optional(),
  }),
});

export const wsUpdateSdMultiplierSchema = z.object({
  type: z.literal('updateSdMultiplier'),
  value: z.number(),
});

export const wsClientMessageSchema = z.discriminatedUnion('type', [
  wsSubscribeSchema,
  wsUnsubscribeSchema,
  wsUpdateFilterSchema,
  wsUpdateSdMultiplierSchema,
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export const wsOptionChainMessageSchema = z.object({
  type: z.literal('optionChain'),
  data: z.record(z.string(), z.any()),
});

export const wsStatusMessageSchema = z.object({
  type: z.literal('status'),
  status: z.enum(['idle', 'warming', 'fetching_quotes', 'subscribing', 'ready', 'error']),
  message: z.string().optional(),
  rowCount: z.number().optional(),
  visibleRowCount: z.number().optional(),
});

export const wsSdMultiplierUpdatedSchema = z.object({
  type: z.literal('sdMultiplierUpdated'),
  success: z.boolean(),
  value: z.number().optional(),
  error: z.string().optional(),
});

export const wsServerMessageSchema = z.discriminatedUnion('type', [
  wsOptionChainMessageSchema,
  wsStatusMessageSchema,
  wsSdMultiplierUpdatedSchema,
]);

export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;
