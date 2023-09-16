import { useInstrumentStore } from '@/stores/instruments';
import { columns } from './columns';
import { DataTable } from './data-table';

export function OptionsTable() {
  const instruments = useInstrumentStore((state) => state.instruments);

  return <DataTable columns={columns} data={instruments} />;
}
