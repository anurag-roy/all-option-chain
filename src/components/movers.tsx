import { useStockStore } from '@/stores/stocks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

function Gainers() {
  const equities = useStockStore((state) => state.equities);
  const gainers = [...equities]
    .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
    .slice(0, 5);
  // .filter((equity) => equity.gainLossPercent > 5);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gainers</TableHead>
          <TableHead className="text-right">LTP</TableHead>
          <TableHead className="text-right">Gain %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gainers.map((equity) => (
          <TableRow key={equity.symbol}>
            <TableCell>{equity.symbol}</TableCell>
            <TableCell className="text-right tabular-nums">
              {equity.ltp.toFixed(2)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {equity.gainLossPercent.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Losers() {
  const equities = useStockStore((state) => state.equities);
  const losers = [...equities]
    .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
    .slice(0, 5);
  // .filter((equity) => equity.gainLossPercent < -5);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Losers</TableHead>
          <TableHead className="text-right">LTP</TableHead>
          <TableHead className="text-right">Loss %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {losers.map((equity) => (
          <TableRow key={equity.symbol}>
            <TableCell>{equity.symbol}</TableCell>
            <TableCell className="text-right tabular-nums">
              {equity.ltp.toFixed(2)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {equity.gainLossPercent.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Movers() {
  return (
    <>
      <Gainers />
      <Losers />
    </>
  );
}
