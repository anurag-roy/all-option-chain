import { getTodayAsParam } from '@/lib/utils';
import { useBansStore } from '@/stores/bans';
import ky from 'ky';
import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export function Bans() {
  const bansStore = useBansStore();

  React.useEffect(() => {
    const dateParam = getTodayAsParam();
    const bansFromLs = localStorage.getItem('bans');

    if (bansFromLs) {
      const bannedStocks = JSON.parse(bansFromLs);
      if (dateParam in bannedStocks) {
        bansStore.setBannedStocks(bannedStocks[dateParam]);
        return;
      }
    }

    ky.get('/api/bans', {
      searchParams: {
        dateParam,
      },
    })
      .json<string[]>()
      .then((bans) => {
        bansStore.setBannedStocks(bans);
        const bannedStocks = {
          [dateParam]: bans,
        };
        localStorage.setItem('bans', JSON.stringify(bannedStocks));
      })
      .catch();
  }, []);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bans</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bansStore.bannedStocks.length === 0 ? (
          <TableRow>
            <TableCell>No bans for today</TableCell>
          </TableRow>
        ) : (
          bansStore.bannedStocks.map((stock) => (
            <TableRow key={stock}>
              <TableCell>{stock}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
