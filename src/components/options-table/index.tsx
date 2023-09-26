import { getRandomIndex, getReturnValue } from '@/lib/utils';
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
  const returnFetchState = React.useRef({
    fetchIndex: 0,
    fetchCount: 0,
  });
  const { toast } = useToast();

  React.useEffect(() => {
    if (!initComplete) return;

    const interval = setInterval(() => {
      const instrument = instruments[returnFetchState.current.fetchIndex];
      getReturnValue(instrument).then(({ returnValue, isMarginAvailable }) => {
        updateReturn(instrument.token, returnValue);
        if (returnValue >= orderPercent && isMarginAvailable) {
          toast({
            title: 'Order Triggered!',
            description: `Order triggered for ${instrument.tradingSymbol} with return ${returnValue} at price ${instrument.bid} and quantity ${instrument.lotSize}`,
          });
        }
      });

      if (instruments.length > 200) {
        if (returnFetchState.current.fetchIndex < 100) {
          returnFetchState.current.fetchIndex++;
          returnFetchState.current.fetchCount++;
        } else if (returnFetchState.current.fetchCount < 200) {
          returnFetchState.current.fetchIndex = getRandomIndex(101, instruments.length - 1);
          returnFetchState.current.fetchCount++;
        } else {
          returnFetchState.current.fetchIndex = 0;
          returnFetchState.current.fetchCount = 0;
        }
      } else {
        if (returnFetchState.current.fetchIndex < instruments.length - 1) {
          returnFetchState.current.fetchIndex++;
          returnFetchState.current.fetchCount++;
        } else {
          returnFetchState.current.fetchIndex = 0;
          returnFetchState.current.fetchCount = 0;
        }
      }
    }, 600);

    return () => clearInterval(interval);
  }, [initComplete]);

  return (
    <div className='border-t p-4'>
      <DataTable columns={columns} data={instruments.filter((i) => i.sellValue >= entryValue)} />
    </div>
  );
}
