import type { NotificationType } from '@client/contexts/notification-context';
import type { WsServerMessage } from '@server/shared/schemas/websocket';
import type { ChainEngineStatus, OptionChainData } from '@shared/types/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseWebSocketOptions {
  subscribedSymbols?: string[];
  onNotification?: (message: string, type: NotificationType) => void;
}

export function useWebSocket({ subscribedSymbols, onNotification }: UseWebSocketOptions = {}) {
  const [optionChainData, setOptionChainData] = useState<OptionChainData>({});
  const [chainStatus, setChainStatus] = useState<ChainEngineStatus['status']>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [rowCount, setRowCount] = useState(0);
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [entryValue, setEntryValue] = useState(99);
  const [orderPercent, setOrderPercent] = useState(0.5);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscribedSymbolsRef = useRef<string[]>(subscribedSymbols ?? []);
  const pendingSubscriptionsRef = useRef<string[]>([]);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        if (subscribedSymbolsRef.current.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', symbols: subscribedSymbolsRef.current }));
        }

        if (pendingSubscriptionsRef.current.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', symbols: pendingSubscriptionsRef.current }));
          subscribedSymbolsRef.current = [
            ...new Set([...subscribedSymbolsRef.current, ...pendingSubscriptionsRef.current]),
          ];
          pendingSubscriptionsRef.current = [];
        }
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as WsServerMessage;

          if (message.type === 'optionChain') {
            setOptionChainData(message.data as OptionChainData);
          }

          if (message.type === 'status') {
            setChainStatus(message.status);
            setStatusMessage(message.message);
            if (message.rowCount !== undefined) {
              setRowCount(message.rowCount);
            }
            if (message.visibleRowCount !== undefined) {
              setVisibleRowCount(message.visibleRowCount);
            }
          }

          if (message.type === 'notification') {
            onNotificationRef.current?.(message.message, message.severity);
            if (message.severity === 'important') {
              toast(message.message.includes('order trigger') ? 'Order Triggered!' : 'Alert', {
                description: message.message,
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.addEventListener('close', () => {
        setIsConnected(false);
        wsRef.current = null;

        const maxAttempts = 5;
        const baseDelay = 1000;

        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(baseDelay * 2 ** reconnectAttemptsRef.current, 30000);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          toast.error('WebSocket connection lost. Please refresh the page.');
        }
      });

      ws.addEventListener('error', () => {
        toast.error('WebSocket connection error');
        setIsConnected(false);
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      toast.error('Failed to create WebSocket connection');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setOptionChainData({});
    pendingSubscriptionsRef.current = [];
    subscribedSymbolsRef.current = [];
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    subscribedSymbolsRef.current = subscribedSymbols ?? [];

    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      subscribedSymbols &&
      subscribedSymbols.length > 0
    ) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', symbols: subscribedSymbols }));
    }
  }, [subscribedSymbols]);

  const subscribe = useCallback((symbols: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', symbols }));
      subscribedSymbolsRef.current = [...new Set([...subscribedSymbolsRef.current, ...symbols])];
    } else {
      pendingSubscriptionsRef.current = [...new Set([...pendingSubscriptionsRef.current, ...symbols])];
    }
  }, []);

  const unsubscribe = useCallback((symbols: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbols }));
    }
  }, []);

  const updateFilter = useCallback(
    (filter: {
      expiry: string;
      sdMultiplier: number;
      entryValue: number;
      orderPercent: number;
      symbols?: string[];
    }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'updateFilter', filter }));
      } else {
        toast.error('WebSocket not connected. Please try again.');
      }
    },
    []
  );

  const updateSdMultiplier = useCallback((value: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'updateSdMultiplier', value }));
    } else {
      toast.error('WebSocket not connected. Please try again.');
    }
  }, []);

  const applyOptionChainData = useCallback((data: OptionChainData) => {
    setOptionChainData(data);
  }, []);

  return {
    optionChainData,
    chainStatus,
    statusMessage,
    rowCount,
    visibleRowCount,
    entryValue,
    setEntryValue,
    orderPercent,
    setOrderPercent,
    applyOptionChainData,
    isConnected,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    updateFilter,
    updateSdMultiplier,
  };
}
