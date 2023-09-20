import { UiInstrument } from '@/types';
import { Row } from '@tanstack/react-table';
import { OrderModal } from '../order-modal';

interface OrderActionProps {
  row: Row<UiInstrument>;
}

export function RowOrderAction({ row }: OrderActionProps) {
  return (
    <div className="flex items-center pr-4">
      {row.original.returnValue < 0.05 ? <OrderModal i={row.original} /> : null}
      <span className="ml-auto">{row.original.returnValue.toFixed(2)}</span>
    </div>
  );
}
