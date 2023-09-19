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
      let bannedStocks = JSON.parse(bansFromLs);
      if (dateParam in bannedStocks) {
        bansStore.setBannedStocks(bannedStocks[dateParam]);
      } else {
        ky.get('/api/bans', {
          searchParams: {
            dateParam,
          },
        })
          .json<string[]>()
          .then((bans) => {
            bansStore.setBannedStocks(bans);
            bannedStocks = {
              [dateParam]: bans,
            };
            localStorage.setItem('bans', JSON.stringify(bannedStocks));
          })
          .catch();
      }
    }
  }, []);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bans</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          {bansStore.bannedStocks.length ? (
            <TableCell>No bans for today</TableCell>
          ) : (
            bansStore.bannedStocks.map((stock) => (
              <TableCell key={stock}>{stock}</TableCell>
            ))
          )}
        </TableRow>
      </TableBody>
    </Table>
  );
}
