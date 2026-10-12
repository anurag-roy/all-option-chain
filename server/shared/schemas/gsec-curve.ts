import { parseBondDate } from '@server/lib/calculators/gsec-cash-flows';
import { z } from 'zod';

const bondDate = z.string().refine((value) => parseBondDate(value) !== null, 'Invalid curve date');
const timestamp = z
  .string()
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)),
    'Invalid curve timestamp'
  );

export const nssParametersSchema = z.object({
  beta0: z.number(),
  beta1: z.number(),
  beta2: z.number(),
  beta3: z.number(),
  tau1: z.number().positive(),
  tau2: z.number().positive(),
});

export const gsecCurveSnapshotSchema = z
  .object({
    id: z.string().min(1),
    provider: z.literal('CCIL'),
    referenceDate: bondDate,
    publicationTimestamp: timestamp.nullable(),
    firstObservedAt: timestamp,
    retrievedAt: timestamp,
    sourceUrl: z.string().url(),
    sourceHash: z.string().min(1),
    method: z.literal('NSS'),
    parameters: nssParametersSchema,
    compounding: z.enum(['continuous', 'annual', 'semiannual']),
    dayCount: z.enum(['ACT/365', 'ACT/360', '30E/360']),
    conventionSource: z.string().min(1),
    minTenor: z.number().nonnegative(),
    maxTenor: z.number().positive(),
  })
  .refine((value) => value.maxTenor > value.minTenor, 'Invalid curve tenor range')
  .refine((value) => Date.parse(value.firstObservedAt) <= Date.parse(value.retrievedAt), 'Invalid observation order');
