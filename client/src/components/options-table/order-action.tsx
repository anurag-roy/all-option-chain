import type { Row } from '@tanstack/react-table';
import type { OptionChainRow } from '../../types/option-chain';
import { OrderModal } from '../order-modal';

interface OrderActionProps {
  row: Row<OptionChainRow>;
}

export function RowOrderAction({ row }: OrderActionProps) {
  return (
    <div className='flex w-full items-center px-2'>
      {row.original.returnValue > 0.05 ? <OrderModal row={row.original} /> : null}
      <span className='ml-auto rounded-full px-2 py-1 ring-1 ring-gray-400 dark:ring-gray-100'>
        {row.original.returnValue.toFixed(2)}
      </span>
    </div>
  );
}
