import { useNotifications } from '@client/contexts/notification-context';
import { useWebSocketContext } from '@client/contexts/websocket-context';
import type { OptionChainRow } from '@client/types/option-chain';
import { memo, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { DataTable } from './data-table';

function useBidAlert(rows: OptionChainRow[], addNotification: ReturnType<typeof useNotifications>['addNotification']) {
  const previousBidsRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }

    const topRow = [...rows].sort((a, b) => b.returnValue - a.returnValue)[0];
    if (!topRow) {
      return;
    }

    const previousBid = previousBidsRef.current.get(topRow.instrumentToken);
    if (previousBid !== undefined && previousBid !== topRow.bid) {
      addNotification(
        `Top bid changed for ${topRow.tradingsymbol}: ${previousBid.toFixed(2)} → ${topRow.bid.toFixed(2)}`,
        'important'
      );
    }

    const nextBids = new Map<number, number>();
    for (const row of rows) {
      nextBids.set(row.instrumentToken, row.bid);
    }
    previousBidsRef.current = nextBids;
  }, [addNotification, rows]);
}

function useOrderPercentAlerts(
  rows: OptionChainRow[],
  orderPercent: number,
  chainReady: boolean,
  addNotification: ReturnType<typeof useNotifications>['addNotification']
) {
  const triggeredRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!chainReady) {
      triggeredRef.current.clear();
    }
  }, [chainReady]);

  useEffect(() => {
    for (const row of rows) {
      if (
        row.returnValue >= orderPercent &&
        row.marginStatus === 'ready' &&
        !triggeredRef.current.has(row.instrumentToken)
      ) {
        triggeredRef.current.add(row.instrumentToken);
        const message = `Order triggered for ${row.tradingsymbol} with return ${row.returnValue.toFixed(2)} at price ${row.bid} and quantity ${row.lotSize}`;
        addNotification(message, 'important');
        toast('Order Triggered!', { description: message });
      }
    }
  }, [addNotification, orderPercent, rows]);
}

export const OptionsTable = memo(function OptionsTable() {
  const { addNotification } = useNotifications();
  const { optionChainData, entryValue, orderPercent, rowCount, chainStatus } = useWebSocketContext();

  const allRows = useMemo(() => Object.values(optionChainData), [optionChainData]);

  const data = useMemo(() => allRows.filter((row) => row.sellValue >= entryValue), [allRows, entryValue]);

  const chainReady = chainStatus === 'ready';

  useBidAlert(data, addNotification);
  useOrderPercentAlerts(data, orderPercent, chainReady, addNotification);

  const emptyMessage = useMemo(() => {
    if (allRows.length === 0 && rowCount === 0) {
      return 'Apply a filter to load the option chain.';
    }
    if (allRows.length === 0 && rowCount > 0) {
      return 'Server loaded instruments but no data reached the client yet. Try reapplying the filter.';
    }
    if (data.length === 0) {
      return `${allRows.length} instruments loaded, but none have sell value ≥ entry value (${entryValue}). On market holidays bids are often 0 — try lowering entry value to 0.`;
    }
    return 'No results.';
  }, [allRows.length, data.length, entryValue, rowCount]);

  const summaryText =
    allRows.length > 0
      ? `Showing ${data.length} of ${allRows.length} instruments (entry value ≥ ${entryValue})`
      : undefined;

  return (
    <div className='border-t p-4'>
      <DataTable data={data} emptyMessage={emptyMessage} summaryText={summaryText} />
    </div>
  );
});
