import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';

export function useChainExpiries() {
  return useQuery({
    queryKey: queryKeys.chain.expiries,
    queryFn: async () => {
      const res = await api.chain.expiries.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch expiries');
      }
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}
