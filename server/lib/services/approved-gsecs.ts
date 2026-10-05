import { parseGsecSymbol } from '@server/lib/calculators/gsecs';
import type { GsecSecurity } from '@shared/types/gsecs';
import { z } from 'zod';

export const APPROVED_SECURITIES_PAGE = 'https://zerodha.com/approved-securities/';
export const APPROVED_SECURITIES_FEED = 'https://public.zrd.sh/crux/approved-securities.json';

export class GsecSeedError extends Error {}

const flagSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const approvedSecuritiesSchema = z
  .array(
    z.object({
      symbol: z.string(),
      isin: z.string().min(1),
      security_type: z.string(),
      is_unapproved: flagSchema,
      limit_breached: flagSchema,
    })
  )
  .min(1);

export function selectApprovedGsecs(payload: unknown): GsecSecurity[] {
  const securities = new Map<string, GsecSecurity>();
  for (const row of approvedSecuritiesSchema.parse(payload)) {
    if (row.security_type.trim().toLowerCase() !== 'government securities' || row.is_unapproved || row.limit_breached) {
      continue;
    }
    const security = parseGsecSymbol(row.symbol);
    if (security) securities.set(security.tradingsymbol, { ...security, isin: row.isin });
  }
  return [...securities.values()];
}
