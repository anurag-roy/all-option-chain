import { useStockStore } from '@/stores/stocks';
import { columns } from './columns';
import { DataTable } from './data-table';

export function OptionsTable() {
  const instruments = useStockStore((state) => state.instruments);

  return (
    <div className="border-t p-4">
      <DataTable columns={columns} data={instruments} />
    </div>
  );
}
