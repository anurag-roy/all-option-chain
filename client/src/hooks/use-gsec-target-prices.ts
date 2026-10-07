import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useGsecTargetPrices(targetYtm: number | null, settlementDate?: string, approvedListFetchedAt?: string) {
  const [appliedTarget, setAppliedTarget] = useState(targetYtm);
  useEffect(() => {
    const timer = setTimeout(() => setAppliedTarget(targetYtm), 300);
    return () => clearTimeout(timer);
  }, [targetYtm]);

  const query = useQuery({
    queryKey: queryKeys.gsecs.targetPrices(appliedTarget, settlementDate, approvedListFetchedAt),
    enabled: appliedTarget !== null && appliedTarget === targetYtm && !!settlementDate && !!approvedListFetchedAt,
    queryFn: async () => {
      const response = await api.gsecs['target-prices'].$get({ query: { targetYtm: String(appliedTarget) } });
      return response.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  // An old target/date must never colour the table while a new one is pending.
  const data =
    query.data?.targetYtm === targetYtm &&
    query.data.settlementDate === settlementDate &&
    query.data.approvedListFetchedAt === approvedListFetchedAt
      ? query.data
      : undefined;
  return { ...query, data, error: appliedTarget === targetYtm ? query.error : null };
}
