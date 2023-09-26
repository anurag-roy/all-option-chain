import { getTodayAsParam } from '@/lib/utils';
import { useBansStore } from '@/stores/bans';
import ky from 'ky';
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

function NseBans({ stocks }: { stocks: string[] }) {
  return (
    <div className='ml-auto h-56 w-full overflow-y-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>NSE Bans ({stocks.length})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.length === 0 ? (
            <TableRow>
              <TableCell>No bans for today</TableCell>
            </TableRow>
          ) : (
            stocks.map((stock) => (
              <TableRow key={stock}>
                <TableCell>{stock}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CustomBans({ stocks }: { stocks: string[] }) {
  return (
    <div className='ml-auto h-56 w-full overflow-y-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Custom Bans ({stocks.length})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.length === 0 ? (
            <TableRow>
              <TableCell>No custom bans</TableCell>
            </TableRow>
          ) : (
            stocks.map((stock) => (
              <TableRow key={stock}>
                <TableCell>{stock}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

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
    <section>
      <h2 className='mb-2 ml-1 text-xl font-bold'>Bans</h2>
      <div className='grid grid-cols-2 gap-4 rounded-md border p-4'>
        <NseBans stocks={bansStore.bannedStocks} />
        <CustomBans stocks={['IDEA']} />
      </div>
    </section>
  );
}
