import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import type { BansResponse } from '@shared/schemas/bans';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useBans() {
  return useQuery({
    queryKey: queryKeys.bans.list,
    queryFn: async () => {
      const res = await api.bans.$get();
      if (!res.ok) {
        throw new Error('Failed to fetch bans');
      }
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
}

export function useToggleBan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.bans.toggle.$post({ json: { name } });
      if (!res.ok) {
        const error = await res.json();
        throw new Error('message' in error ? String(error.message) : 'Failed to toggle ban');
      }
      return res.json();
    },
    onSuccess: (data: BansResponse) => {
      queryClient.setQueryData(queryKeys.bans.list, data);
    },
  });
}

export function useApplyCustomBans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ desired, current }: { desired: string[]; current: string[] }) => {
      const desiredSet = new Set(desired);
      const currentSet = new Set(current);
      const toToggle = [
        ...desired.filter((name) => !currentSet.has(name)),
        ...current.filter((name) => !desiredSet.has(name)),
      ];

      let response: BansResponse | undefined;
      for (const name of toToggle) {
        const res = await api.bans.toggle.$post({ json: { name } });
        if (!res.ok) {
          const error = await res.json();
          throw new Error('message' in error ? String(error.message) : 'Failed to update bans');
        }
        response = await res.json();
      }

      return response ?? (await api.bans.$get().then((res) => res.json()));
    },
    onSuccess: (data: BansResponse) => {
      queryClient.setQueryData(queryKeys.bans.list, data);
    },
  });
}
