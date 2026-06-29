import { z } from 'zod';

export const orderMarginRequestSchema = z.object({
  tradingsymbol: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
});

export const orderSellRequestSchema = z.object({
  tradingsymbol: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
});

export const depthLevelSchema = z.object({
  price: z.number(),
  quantity: z.number(),
});

export const orderQuoteResponseSchema = z.object({
  buy: z.array(depthLevelSchema),
  sell: z.array(depthLevelSchema),
});

export const orderMarginResponseSchema = z.object({
  orderMargin: z.number(),
  cash: z.number(),
  marginUsedPrev: z.number(),
  insufficientBalance: z.boolean(),
});

export type OrderMarginRequest = z.infer<typeof orderMarginRequestSchema>;
export type OrderSellRequest = z.infer<typeof orderSellRequestSchema>;
export type OrderQuoteResponse = z.infer<typeof orderQuoteResponseSchema>;
export type OrderMarginResponse = z.infer<typeof orderMarginResponseSchema>;
