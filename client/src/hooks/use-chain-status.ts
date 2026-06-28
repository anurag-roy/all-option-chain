import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';

export function useChainStatus() {
  return useQuery({
    queryKey: queryKeys.chain.status,
    queryFn: async () => {
      const res = await api.chain.status.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch chain status');
      }
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
