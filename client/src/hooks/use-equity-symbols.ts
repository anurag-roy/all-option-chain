import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';

export function useEquitySymbols() {
  return useQuery({
    queryKey: queryKeys.chain.equities,
    queryFn: async () => {
      const response = await api.chain.equities.$get();
      if (!response.ok) {
        throw new Error('Failed to fetch equity symbols');
      }
      return response.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}
