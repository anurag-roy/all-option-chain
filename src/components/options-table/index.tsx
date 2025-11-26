import { getReturnValue } from '@/lib/utils';
import { useStockStore } from '@/stores/stocks';
import * as React from 'react';
import { useToast } from '../ui/use-toast';
import { useColumns } from './columns';
import { DataTable } from './data-table';

export const OptionsTable = React.memo(function OptionsTable() {
  const instruments = useStockStore((state) => state.instruments);
  const entryValue = useStockStore((state) => state.entryValue);
  const orderPercent = useStockStore((state) => state.orderPercent);
  const initComplete = useStockStore((state) => state.initComplete);
  const updateReturn = useStockStore((state) => state.updateReturn);
  const fetchIndexRef = React.useRef(0);
  const { toast } = useToast();
  const columns = useColumns();

  // Use refs to store current values to avoid dependency issues
  const instrumentsRef = React.useRef(instruments);
  const entryValueRef = React.useRef(entryValue);
  const orderPercentRef = React.useRef(orderPercent);
  const updateReturnRef = React.useRef(updateReturn);
  const toastRef = React.useRef(toast);

  // Update refs when values change
  React.useEffect(() => {
    instrumentsRef.current = instruments;
  }, [instruments]);

  React.useEffect(() => {
    entryValueRef.current = entryValue;
  }, [entryValue]);

  React.useEffect(() => {
    orderPercentRef.current = orderPercent;
  }, [orderPercent]);

  React.useEffect(() => {
    updateReturnRef.current = updateReturn;
  }, [updateReturn]);

  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const filteredInstruments = React.useMemo(
    () => instruments.filter((i) => i.sellValue >= entryValue),
    [instruments, entryValue]
  );

  React.useEffect(() => {
    if (!initComplete) return;

    // Reset the index when starting a new interval
    fetchIndexRef.current = 0;

    const interval = setInterval(() => {
      // Get current filtered instruments using refs to avoid stale closures
      const currentInstruments = instrumentsRef.current.filter((i) => i.sellValue >= entryValueRef.current);
      const instrument = currentInstruments[fetchIndexRef.current];

      if (!instrument) {
        // Reset index if we're out of bounds
        fetchIndexRef.current = 0;
        return;
      }

      getReturnValue(instrument)
        .then(({ returnValue, isMarginAvailable }) => {
          updateReturnRef.current(instrument.token, returnValue);
          if (returnValue >= orderPercentRef.current && isMarginAvailable) {
            toastRef.current({
              title: 'Order Triggered!',
              description: `Order triggered for ${instrument.tradingSymbol} with return ${returnValue} at price ${instrument.bid} and quantity ${instrument.lotSize}`,
            });
          }
        })
        .catch((err) => {
          console.error(err);
        });

      // Update index for next iteration
      if (fetchIndexRef.current < currentInstruments.length - 1) {
        fetchIndexRef.current++;
      } else {
        fetchIndexRef.current = 0;
      }
    }, 500);

    return () => clearInterval(interval);
  }, [initComplete]);

  return (
    <div className='border-t p-4'>
      <DataTable columns={columns} data={filteredInstruments} />
    </div>
  );
});
