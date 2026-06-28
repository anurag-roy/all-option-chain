import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';

export function useUserMargin() {
  return useQuery({
    queryKey: queryKeys.user.margin,
    queryFn: async () => {
      const res = await api.user.margin.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch user margin');
      }
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
