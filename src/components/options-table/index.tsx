import { getReturnValue } from '@/lib/utils';
import { useStockStore } from '@/stores/stocks';
import * as React from 'react';
import { useToast } from '../ui/use-toast';
import { columns } from './columns';
import { DataTable } from './data-table';

export function OptionsTable() {
  const instruments = useStockStore((state) => state.instruments);
  const entryValue = useStockStore((state) => state.entryValue);
  const orderPercent = useStockStore((state) => state.orderPercent);
  const initComplete = useStockStore((state) => state.initComplete);
  const updateReturn = useStockStore((state) => state.updateReturn);
  const fetchIndexRef = React.useRef(0);
  const { toast } = useToast();

  const filteredInstruments = instruments.filter((i) => i.sellValue >= entryValue);

  React.useEffect(() => {
    if (!initComplete) return;

    const interval = setInterval(() => {
      const instrument = filteredInstruments[fetchIndexRef.current];
      getReturnValue(instrument)
        .then(({ returnValue, isMarginAvailable }) => {
          updateReturn(instrument.token, returnValue);
          if (returnValue >= orderPercent && isMarginAvailable) {
            toast({
              title: 'Order Triggered!',
              description: `Order triggered for ${instrument.tradingSymbol} with return ${returnValue} at price ${instrument.bid} and quantity ${instrument.lotSize}`,
            });
          }
        })
        .catch((err) => {
          console.error(err);
        });

      if (fetchIndexRef.current < filteredInstruments.length - 1) {
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
}
