import { useWebSocket } from '@client/hooks/use-websocket';
import type { ChainEngineStatus, OptionChainData } from '@shared/types/types';
import { createContext, useContext, type ReactNode } from 'react';

interface WebSocketContextType {
  optionChainData: OptionChainData;
  chainStatus: ChainEngineStatus['status'];
  statusMessage?: string;
  rowCount: number;
  visibleRowCount: number;
  entryValue: number;
  setEntryValue: (value: number) => void;
  orderPercent: number;
  setOrderPercent: (value: number) => void;
  applyOptionChainData: (data: OptionChainData) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  updateFilter: (filter: {
    expiry: string;
    sdMultiplier: number;
    entryValue: number;
    orderPercent: number;
    symbols?: string[];
  }) => void;
  updateSdMultiplier: (value: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: ReactNode;
  symbols?: string[];
}

export function WebSocketProvider({ children, symbols }: WebSocketProviderProps) {
  const webSocketData = useWebSocket(symbols);

  return <WebSocketContext.Provider value={webSocketData}>{children}</WebSocketContext.Provider>;
}
