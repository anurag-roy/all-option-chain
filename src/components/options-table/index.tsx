import { useStockStore } from '@/stores/stocks';
import { columns } from './columns';
import { DataTable } from './data-table';

export function OptionsTable() {
  const instruments = useStockStore((state) => state.instruments);

  return <DataTable columns={columns} data={instruments} />;
}
