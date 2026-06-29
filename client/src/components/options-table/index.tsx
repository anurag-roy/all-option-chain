import { useWebSocketContext } from '@client/contexts/websocket-context';
import { memo, useMemo } from 'react';
import { DataTable } from './data-table';

export const OptionsTable = memo(function OptionsTable() {
  const { optionChainData, entryValue, rowCount } = useWebSocketContext();

  const allRows = useMemo(() => Object.values(optionChainData), [optionChainData]);

  const data = useMemo(() => allRows.filter((row) => row.sellValue >= entryValue), [allRows, entryValue]);

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
