import { SellerDepthDialog } from '@client/components/gsecs/seller-depth-dialog';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useGsecTargetPrices } from '@client/hooks/use-gsec-target-prices';
import { useGsecs } from '@client/hooks/use-gsecs';
import { formatGsecRrr } from '@shared/lib/format-gsec-rrr';
import { DEFAULT_GSEC_TARGET_YTM, gsecTargetYtmSchema } from '@shared/schemas/gsecs';
import { ArrowDownIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';

type Ranking = 'bestRrrRank' | 'nearFvRank';
const bondDateFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function GsecScanner() {
  const { data, error, isPending, isLive } = useGsecs();
  const [search, setSearch] = useState('');
  const [ranking, setRanking] = useState<Ranking>('bestRrrRank');
  const [targetInput, setTargetInput] = useState(String(DEFAULT_GSEC_TARGET_YTM));
  const parsedTarget = gsecTargetYtmSchema.safeParse(targetInput.trim() ? Number(targetInput) : NaN);
  const targetYtm = parsedTarget.success ? parsedTarget.data : null;
  const targetPrices = useGsecTargetPrices(targetYtm, data?.settlementDate, data?.approvedListFetchedAt);
  const rows = [...(data?.rows ?? [])]
    .filter((row) =>
      `${row.tradingsymbol} ${row.coupon} ${row.maturityYear} ${row.maturityDate}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )
    .sort(
      (a, b) => (a[ranking] ?? Infinity) - (b[ranking] ?? Infinity) || a.tradingsymbol.localeCompare(b.tradingsymbol)
    );

  return (
    <section className='w-[80rem] max-w-[calc(100vw-2rem)] space-y-6 px-4'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <h2 className='text-2xl font-semibold text-balance'>Pledgeable G-Secs</h2>
        <a
          href='https://zerodha.com/approved-securities/'
          target='_blank'
          rel='noreferrer'
          className='text-muted-foreground hover:text-foreground ml-auto inline-flex min-h-10 items-center gap-1.5 text-sm underline underline-offset-4'
        >
          Zerodha Approved Securities <ExternalLinkIcon className='size-3.5' aria-hidden='true' />
        </a>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Input
          aria-label='Search G-Secs by symbol, coupon or maturity date'
          placeholder='Search G-Sec or maturity year…'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='h-10 w-full sm:max-w-xs'
        />
        <div className='flex items-center gap-2'>
          <Label htmlFor='gsec-target-ytm' className='whitespace-nowrap'>
            Target YTM (%)
          </Label>
          <Input
            id='gsec-target-ytm'
            type='number'
            min={0}
            max={100}
            step='any'
            value={targetInput}
            onChange={(event) => setTargetInput(event.target.value)}
            aria-invalid={!parsedTarget.success}
            aria-describedby={!parsedTarget.success ? 'gsec-target-error' : undefined}
            className='h-10 w-24 tabular-nums'
          />
        </div>
        <div className='flex items-center gap-2' role='group' aria-label='G-Sec ranking'>
          <Button
            size='lg'
            variant={ranking === 'bestRrrRank' ? 'secondary' : 'ghost'}
            aria-pressed={ranking === 'bestRrrRank'}
            className='transition-colors'
            onClick={() => setRanking('bestRrrRank')}
          >
            Best RRR
          </Button>
          <Button
            size='lg'
            variant={ranking === 'nearFvRank' ? 'secondary' : 'ghost'}
            aria-pressed={ranking === 'nearFvRank'}
            className='transition-colors'
            onClick={() => setRanking('nearFvRank')}
          >
            Near FV
          </Button>
        </div>
      </div>

      {!parsedTarget.success ? (
        <p id='gsec-target-error' role='alert' className='text-destructive text-sm'>
          Enter a target YTM between 0% and 100%.
        </p>
      ) : targetPrices.error && !error ? (
        <p role='alert' className='text-destructive text-sm'>
          Max buy prices unavailable: {targetPrices.error.message}
        </p>
      ) : null}

      {error ? (
        <div role='alert' className='border-destructive/30 text-destructive rounded-md border p-4 text-sm'>
          {error.message}
        </div>
      ) : (
        <div className='bg-background rounded-lg border'>
          <Table className='tabular-nums'>
            <TableHeader>
              <TableRow>
                <TableHead className='pl-4'>G-Sec</TableHead>
                <TableHead className='text-center'>Coupon</TableHead>
                <TableHead className='text-center'>Maturity</TableHead>
                <TableHead className='text-center' title='Best NSE seller price, including accrued interest'>
                  Sell Rate
                </TableHead>
                <TableHead
                  className='text-center'
                  title={`Maximum dirty buy price for ${targetYtm ?? '—'}% YTM, floored to ₹0.01`}
                >
                  Max Buy Price
                </TableHead>
                <TableHead
                  className='text-center'
                  title={`Quoted annual YTM. T+1 settlement: ${data?.settlementDate ?? '—'}`}
                >
                  RRR (YTM)
                </TableHead>
                <TableHead className='text-center' aria-sort={ranking === 'bestRrrRank' ? 'ascending' : 'none'}>
                  <button
                    type='button'
                    className='focus-visible:outline-ring inline-flex min-h-10 items-center gap-1 rounded px-1 focus-visible:outline-2'
                    onClick={() => setRanking('bestRrrRank')}
                  >
                    Best RRR Rank{' '}
                    {ranking === 'bestRrrRank' ? <ArrowDownIcon className='size-3.5' aria-hidden='true' /> : null}
                  </button>
                </TableHead>
                <TableHead className='text-center'>Distance from FV</TableHead>
                <TableHead className='text-center' aria-sort={ranking === 'nearFvRank' ? 'ascending' : 'none'}>
                  <button
                    type='button'
                    className='focus-visible:outline-ring inline-flex min-h-10 items-center gap-1 rounded px-1 focus-visible:outline-2'
                    onClick={() => setRanking('nearFvRank')}
                  >
                    Near FV Rank{' '}
                    {ranking === 'nearFvRank' ? <ArrowDownIcon className='size-3.5' aria-hidden='true' /> : null}
                  </button>
                </TableHead>
                <TableHead className='pr-4'>
                  <span className='sr-only'>Market depth</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending || rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className='text-muted-foreground py-12 text-center'>
                    {isPending
                      ? 'Loading approved G-Secs and seller quotes…'
                      : search
                        ? 'No G-Secs match your search.'
                        : 'No pledgeable G-Secs available.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const maxBuyPrice = targetPrices.data?.prices[row.tradingsymbol] ?? null;
                  const withinTarget = row.sellRate !== null && maxBuyPrice !== null && row.sellRate <= maxBuyPrice;
                  return (
                    <TableRow
                      key={row.tradingsymbol}
                      className={withinTarget ? 'bg-success/10 hover:bg-success/15' : undefined}
                    >
                      <TableCell className='pl-4 font-medium'>{row.tradingsymbol}</TableCell>
                      <TableCell className='text-center'>{row.coupon}</TableCell>
                      <TableCell className='text-center whitespace-nowrap'>
                        {row.maturityDate
                          ? bondDateFormat.format(new Date(`${row.maturityDate}T00:00:00Z`))
                          : row.maturityYear}
                      </TableCell>
                      <TableCell className={withinTarget ? 'text-success text-center font-semibold' : 'text-center'}>
                        {row.sellRate === null ? (
                          <span className='text-muted-foreground text-xs'>
                            {row.quoteStatus === 'unavailable' ? 'Quote unavailable' : 'No sellers'}
                          </span>
                        ) : (
                          <>
                            {row.sellRate.toFixed(2)}
                            {withinTarget ? <span className='sr-only'>, within target YTM price ceiling</span> : null}
                          </>
                        )}
                      </TableCell>
                      <TableCell className={withinTarget ? 'text-success text-center font-semibold' : 'text-center'}>
                        {maxBuyPrice === null ? '—' : maxBuyPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className='text-center font-semibold'>
                        {row.rrr === null ? '—' : formatGsecRrr(row.rrr)}
                      </TableCell>
                      <TableCell className='text-center'>{row.bestRrrRank ?? '—'}</TableCell>
                      <TableCell className='text-center'>
                        {row.distanceFromFv === null ? '—' : row.distanceFromFv.toFixed(2)}
                      </TableCell>
                      <TableCell className='text-center'>{row.nearFvRank ?? '—'}</TableCell>
                      <TableCell className='pr-4 text-right'>
                        <SellerDepthDialog row={row} isLive={isLive} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
