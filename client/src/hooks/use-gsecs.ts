import { useWebSocketContext } from '@client/contexts/websocket-context';
import { api } from '@client/lib/api';
import { queryKeys } from '@client/lib/query-keys';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useGsecs(scenarioBase: number | null = 0) {
  const { gsecData, applyGsecData, setGsecSubscription, isConnected } = useWebSocketContext();
  useEffect(() => {
    if (scenarioBase !== null) setGsecSubscription(true, scenarioBase);
  }, [setGsecSubscription, scenarioBase]);
  useEffect(() => () => setGsecSubscription(false), [setGsecSubscription]);

  const query = useQuery({
    queryKey: queryKeys.gsecs.scan,
    queryFn: async () => {
      const response = await api.gsecs.$get({ query: { refresh: 'true', scenarioBase: String(scenarioBase ?? 0) } });
      const snapshot = await response.json();
      applyGsecData(snapshot);
      return snapshot;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const data = gsecData ?? query.data;
  const error =
    data?.streamStatus === 'error'
      ? new Error(data.message ?? 'G-Sec data unavailable.')
      : gsecData && isConnected
        ? null
        : query.error;
  return {
    ...query,
    data,
    error,
    isPending: !data && query.isPending,
    isLive: isConnected && data?.streamStatus === 'live',
  };
}
