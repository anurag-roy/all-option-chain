import { z } from 'zod';

const requiredNumber = z.number({ message: 'Required' });

export const amoStockRowSchema = z.object({
  isAmo: z.boolean(),
  tradingsymbol: z.string().min(1, 'Select a stock'),
  value: requiredNumber,
  ltp: requiredNumber,
  lowerCircuit: requiredNumber,
  leg1: requiredNumber,
  leg2: requiredNumber,
  leg3: requiredNumber,
});

export const amoFormSchema = z.object({
  stocks: z.array(amoStockRowSchema).min(1),
});

export const amoOrderItemSchema = z.object({
  tradingsymbol: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  isAmo: z.boolean(),
});

export const amoBatchRequestSchema = z.object({
  orders: z.array(amoOrderItemSchema).min(1),
});

export type AmoStockRow = z.infer<typeof amoStockRowSchema>;
export type AmoFormValues = z.infer<typeof amoFormSchema>;
export type AmoOrderItem = z.infer<typeof amoOrderItemSchema>;
