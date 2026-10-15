import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { gsecKey } from '@shared/lib/gsec-key';
import type { GsecRow } from '@shared/types/gsecs';
import { useQuery } from '@tanstack/react-query';

export function useGsecBondAnalytics(
  row: GsecRow,
  settlementDate: string,
  approvedListFetchedAt: string,
  targetYtm: number | null,
  customMonths: number | null
) {
  const curveSnapshotId = row.curveAnalytics?.snapshotId ?? null;
  const query = useQuery({
    queryKey: queryKeys.gsecs.bondAnalytics(
      gsecKey(row),
      row.sellRate,
      settlementDate,
      approvedListFetchedAt,
      curveSnapshotId,
      targetYtm,
      customMonths
    ),
    queryFn: async () => {
      const response = await api.gsecs['bond-analytics'].$get({
        query: {
          exchange: row.exchange,
          tradingsymbol: row.tradingsymbol,
          ...(targetYtm === null ? {} : { targetYtm: String(targetYtm) }),
          ...(customMonths === null ? {} : { customMonths: String(customMonths) }),
        },
      });
      return response.json();
    },
    staleTime: Infinity,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const data = query.data;
  // Never mix ratings or carry rows with another price, target, curve or daily seed.
  const matches =
    data?.sellRate === row.sellRate &&
    data.settlementDate === settlementDate &&
    data.approvedListFetchedAt === approvedListFetchedAt &&
    data.curveSnapshotId === curveSnapshotId &&
    data.targetYtm === targetYtm &&
    data.customMonths === customMonths;
  return {
    ...query,
    data: matches ? data : undefined,
    error: query.error ?? (data && !matches ? new Error('Bond data changed. Reload to update.') : null),
  };
}
