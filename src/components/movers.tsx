import { useEquityStore } from '@/stores/equities';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

function Gainers() {
  const equities = useEquityStore((state) => state.equities);
  const sortedEquities = equities.toSorted(
    (a, b) => b.gainLossPercent - a.gainLossPercent
  );
  const gainers = sortedEquities
    .slice(0, 5)
    .filter((equity) => equity.gainLossPercent > 5);

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
        <TableRow>
          {gainers.map((equity) => (
            <>
              <TableCell>{equity.symbol}</TableCell>
              <TableCell className="text-right tabular-nums">
                {equity.ltp.toFixed(2)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {equity.gainLossPercent.toFixed(2)}
              </TableCell>
            </>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

function Losers() {
  const equities = useEquityStore((state) => state.equities);
  const sortedEquities = equities.toSorted(
    (a, b) => b.gainLossPercent - a.gainLossPercent
  );
  const losers = sortedEquities
    .slice(-5)
    .filter((equity) => equity.gainLossPercent < -5);

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
        <TableRow>
          {losers.map((equity) => (
            <>
              <TableCell>{equity.symbol}</TableCell>
              <TableCell className="text-right tabular-nums">
                {equity.ltp.toFixed(2)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {equity.gainLossPercent.toFixed(2)}
              </TableCell>
            </>
          ))}
        </TableRow>
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
