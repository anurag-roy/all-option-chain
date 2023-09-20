import { useStockStore } from '@/stores/stocks';
import { UiEquity } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

function MoverTableBody({ rows }: { rows: UiEquity[] }) {
  return (
    <TableBody>
      {[0, 1, 2, 3, 4].map((i) =>
        rows[i] ? (
          <TableRow key={rows[i].symbol}>
            <TableCell>{rows[i].symbol}</TableCell>
            <TableCell className="tabular-nums">
              {rows[i].ltp.toFixed(2)}
            </TableCell>
            <TableCell className="tabular-nums">
              {rows[i].gainLossPercent.toFixed(2)}
            </TableCell>
          </TableRow>
        ) : (
          <TableRow key={i}>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
            <TableCell>-</TableCell>
          </TableRow>
        )
      )}
    </TableBody>
  );
}

function Gainers() {
  const equities = useStockStore((state) => state.equities);
  const gainers = [...equities]
    .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
    .slice(0, 5);
  // .filter((equity) => equity.gainLossPercent > 5);

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gainers</TableHead>
            <TableHead>LTP</TableHead>
            <TableHead>Gain %</TableHead>
          </TableRow>
        </TableHeader>
        <MoverTableBody rows={gainers} />
      </Table>
    </div>
  );
}

function Losers() {
  const equities = useStockStore((state) => state.equities);
  const losers = [...equities]
    .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
    .slice(0, 5);
  // .filter((equity) => equity.gainLossPercent < -5);

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Losers</TableHead>
            <TableHead>LTP</TableHead>
            <TableHead>Loss %</TableHead>
          </TableRow>
        </TableHeader>
        <MoverTableBody rows={losers} />
      </Table>
    </div>
  );
}

export function Movers() {
  return (
    <section>
      <h2 className="text-xl font-bold mb-2 ml-1">Movers</h2>
      <div className="grid grid-cols-2 gap-4 p-4 border rounded-md">
        <Gainers />
        <Losers />
      </div>
    </section>
  );
}
