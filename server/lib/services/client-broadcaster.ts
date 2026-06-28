import { logger } from '@server/lib/logger';
import type { ChainEngineStatus, OptionChainData } from '@shared/types/types';
import type { WsClientMessage, WsServerMessage } from '@server/shared/schemas/websocket';
import { wsClientMessageSchema } from '@server/shared/schemas/websocket';
import type { WSContext } from 'hono/ws';
import { randomUUID } from 'node:crypto';

interface ClientSubscription {
  ws: WSContext;
  symbols: Set<string>;
}

export class ClientBroadcaster {
  private clients = new Map<string, ClientSubscription>();
  private latestOptionChain: OptionChainData = {};
  private updateFilterFn: ((filter: WsClientMessage & { type: 'updateFilter' }) => Promise<boolean>) | null = null;
  private updateSdMultiplierFn: ((value: number) => Promise<boolean>) | null = null;

  setCallbacks(callbacks: {
    updateFilter: (filter: Extract<WsClientMessage, { type: 'updateFilter' }>) => Promise<boolean>;
    updateSdMultiplier: (value: number) => Promise<boolean>;
  }) {
    this.updateFilterFn = callbacks.updateFilter;
    this.updateSdMultiplierFn = callbacks.updateSdMultiplier;
  }

  publishOptionChain(data: OptionChainData, status: ChainEngineStatus) {
    this.latestOptionChain = data;

    for (const [clientId, subscription] of this.clients.entries()) {
      this.sendToClient(clientId, subscription, {
        type: 'optionChain',
        data: this.filterForClient(subscription, data),
      });
      this.sendToClient(clientId, subscription, {
        type: 'status',
        status: status.status,
        message: status.message,
        rowCount: status.rowCount,
        visibleRowCount: status.visibleRowCount,
      });
    }
  }

  handleOpen(ws: WSContext) {
    const clientId = randomUUID();
    this.clients.set(clientId, { ws, symbols: new Set() });
    logger.info(`Client ${clientId} connected. Total clients: ${this.clients.size}`);
    return clientId;
  }

  async handleMessage(clientId: string, raw: string) {
    const subscription = this.clients.get(clientId);
    if (!subscription) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const result = wsClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn(`Invalid websocket message from ${clientId}`);
      return;
    }

    const message = result.data;

    if (message.type === 'subscribe') {
      for (const symbol of message.symbols) {
        subscription.symbols.add(symbol);
      }
      this.sendToClient(clientId, subscription, {
        type: 'optionChain',
        data: this.filterForClient(subscription, this.latestOptionChain),
      });
      return;
    }

    if (message.type === 'unsubscribe') {
      for (const symbol of message.symbols) {
        subscription.symbols.delete(symbol);
      }
      this.sendToClient(clientId, subscription, {
        type: 'optionChain',
        data: this.filterForClient(subscription, this.latestOptionChain),
      });
      return;
    }

    if (message.type === 'updateFilter' && this.updateFilterFn) {
      const success = await this.updateFilterFn(message);
      this.sendToClient(clientId, subscription, {
        type: 'sdMultiplierUpdated',
        success,
        value: message.filter.sdMultiplier,
      });
      return;
    }

    if (message.type === 'updateSdMultiplier' && this.updateSdMultiplierFn) {
      const success = await this.updateSdMultiplierFn(message.value);
      this.sendToClient(clientId, subscription, {
        type: 'sdMultiplierUpdated',
        success,
        value: message.value,
      });
    }
  }

  handleClose(clientId: string) {
    this.clients.delete(clientId);
    logger.info(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
  }

  private filterForClient(subscription: ClientSubscription, data: OptionChainData) {
    if (subscription.symbols.size === 0) {
      return data;
    }

    const filtered: OptionChainData = {};
    for (const [token, row] of Object.entries(data)) {
      if (subscription.symbols.has(row.name)) {
        filtered[Number(token)] = row;
      }
    }
    return filtered;
  }

  private sendToClient(clientId: string, subscription: ClientSubscription, message: WsServerMessage) {
    try {
      subscription.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send websocket message to ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }
}

export const clientBroadcaster = new ClientBroadcaster();
