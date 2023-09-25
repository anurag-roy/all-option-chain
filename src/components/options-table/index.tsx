import { getRandomIndex, getReturnValue } from '@/lib/utils';
import { useStockStore } from '@/stores/stocks';
import * as React from 'react';
import { columns } from './columns';
import { DataTable } from './data-table';

export function OptionsTable() {
  const instruments = useStockStore((state) => state.instruments);
  const initComplete = useStockStore((state) => state.initComplete);
  const updateReturn = useStockStore((state) => state.updateReturn);
  const returnFetchState = React.useRef({
    fetchIndex: 0,
    fetchCount: 0,
  });

  React.useEffect(() => {
    if (!initComplete) return;

    const interval = setInterval(() => {
      const instrument = instruments[returnFetchState.current.fetchIndex];
      getReturnValue(instrument).then((value) =>
        updateReturn(instrument.token, value)
      );

      if (instruments.length > 200) {
        if (returnFetchState.current.fetchIndex < 100) {
          returnFetchState.current.fetchIndex++;
          returnFetchState.current.fetchCount++;
        } else if (returnFetchState.current.fetchCount < 200) {
          returnFetchState.current.fetchIndex = getRandomIndex(
            101,
            instruments.length - 1
          );
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
    <div className="border-t p-4">
      <DataTable columns={columns} data={instruments} />
    </div>
  );
}
