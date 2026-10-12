import { BondCardDialog } from '@client/components/gsecs/bond-card-dialog';
import { formatBondDate, formatMoney, formatNumber } from '@client/components/gsecs/gsec-format';
import { GsecName } from '@client/components/gsecs/gsec-name';
import { RelativeValue } from '@client/components/gsecs/relative-value';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useGsecTargetPrices } from '@client/hooks/use-gsec-target-prices';
import { useGsecs } from '@client/hooks/use-gsecs';
import { cn } from '@client/lib/utils';
import { formatGsecRrr } from '@shared/lib/format-gsec-rrr';
import { gsecKey } from '@shared/lib/gsec-key';
import { DEFAULT_GSEC_TARGET_YTM, gsecTargetYtmSchema } from '@shared/schemas/gsecs';
import type { GsecRow } from '@shared/types/gsecs';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';

type SortColumn = 'rank' | 'modifiedDuration' | 'relativeValue';
type GsecSort = { column: SortColumn; descending: boolean };
const relativeValueOrder = { CHEAP: 0, FAIR: 1, RICH: 2 };

function sortValue(row: GsecRow, column: SortColumn): number | null {
  switch (column) {
    case 'rank':
      return row.bestRrrRank;
    case 'modifiedDuration':
      return row.analytics?.risk?.modifiedDuration ?? null;
    case 'relativeValue': {
      const value = row.curveAnalytics?.relativeValue;
      return value ? relativeValueOrder[value] : null;
    }
  }
}

function SortableHead({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: GsecSort;
  onSort: (column: SortColumn) => void;
}) {
  const active = sort.column === column;
  const nextDescending = active && !sort.descending;
  const Icon = active ? (sort.descending ? ArrowDownIcon : ArrowUpIcon) : ArrowUpDownIcon;

  return (
    <TableHead className='text-center' aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}>
      <button
        type='button'
        className='focus-visible:outline-ring inline-flex min-h-10 cursor-pointer items-center gap-1 rounded px-1 focus-visible:outline-2'
        aria-label={`Sort ${label} ${nextDescending ? 'descending' : 'ascending'}`}
        onClick={() => onSort(column)}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'text-muted-foreground')} aria-hidden='true' />
      </button>
    </TableHead>
  );
}

export function GsecScanner() {
  const { data, error, isPending, isLive } = useGsecs();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<GsecSort>({ column: 'rank', descending: false });
  const toggleSort = (column: SortColumn) =>
    setSort((current) => ({ column, descending: current.column === column ? !current.descending : false }));
  const [targetInput, setTargetInput] = useState(String(DEFAULT_GSEC_TARGET_YTM));
  const parsedTarget = gsecTargetYtmSchema.safeParse(targetInput.trim() ? Number(targetInput) : NaN);
  const targetYtm = parsedTarget.success ? parsedTarget.data : null;
  const targetPrices = useGsecTargetPrices(targetYtm, data?.settlementDate, data?.approvedListFetchedAt);
  const rows = [...(data?.rows ?? [])]
    .filter((row) =>
      `${row.exchange} ${row.tradingsymbol} ${row.isin} ${row.coupon} ${row.maturityYear} ${row.maturityDate}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      const symbolOrder = gsecKey(a).localeCompare(gsecKey(b));
      const rankOrder =
        a.bestRrrRank === null
          ? b.bestRrrRank === null
            ? 0
            : 1
          : b.bestRrrRank === null
            ? -1
            : a.bestRrrRank - b.bestRrrRank;
      const tieBreak = rankOrder || symbolOrder;
      const aValue = sortValue(a, sort.column);
      const bValue = sortValue(b, sort.column);
      // Missing values stay last in either direction.
      if (aValue === null) return bValue === null ? tieBreak : 1;
      if (bValue === null) return -1;
      return (sort.descending ? -1 : 1) * (aValue - bValue) || tieBreak;
    });

  return (
    <section className='border-border bg-card w-[100rem] max-w-[calc(100vw-2rem)] rounded-md border'>
      <div className='border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3'>
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

      <div className='space-y-4 p-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Input
            aria-label='Search G-Secs by exchange, symbol, ISIN, coupon or maturity date'
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
        </div>

        {!parsedTarget.success ? (
          <p id='gsec-target-error' role='alert' className='text-destructive text-sm'>
            Enter a target YTM between 0% and 100%.
          </p>
        ) : targetPrices.error && !error ? (
          <p role='alert' className='text-destructive text-sm'>
            Buy rates unavailable: {targetPrices.error.message}
          </p>
        ) : null}

        {error ? (
          <div role='alert' className='border-destructive/30 text-destructive rounded-md border p-4 text-sm'>
            {error.message}
          </div>
        ) : (
          <div className='bg-background rounded-md border'>
            <Table className='tabular-nums'>
              <TableHeader>
                <TableRow>
                  <TableHead className='pl-4'>G-Sec</TableHead>
                  <SortableHead column='rank' label='RRR Rank' sort={sort} onSort={toggleSort} />
                  <TableHead className='text-center'>Coupon</TableHead>
                  <TableHead className='text-center'>Maturity</TableHead>
                  <TableHead className='text-center'>Sell Rate</TableHead>
                  <TableHead className='text-center'>RRR (YTM)</TableHead>
                  <TableHead className='text-center'>Buy Rate</TableHead>
                  <SortableHead column='modifiedDuration' label='Mod Dur' sort={sort} onSort={toggleSort} />
                  <TableHead className='text-center'>DV01</TableHead>
                  <TableHead className='text-center'>Convexity</TableHead>
                  <TableHead className='text-center'>Curve Spr.</TableHead>
                  <SortableHead column='relativeValue' label='RV' sort={sort} onSort={toggleSort} />
                  <TableHead className='pr-4'>
                    <span className='sr-only'>Bond Card</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending || rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className='text-muted-foreground py-12 text-center'>
                      {isPending
                        ? 'Loading approved G-Secs and seller quotes…'
                        : search
                          ? 'No G-Secs match your search.'
                          : 'No pledgeable G-Secs available.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const maxBuyPrice = targetPrices.data?.prices[gsecKey(row)] ?? null;
                    const withinTarget = row.sellRate !== null && maxBuyPrice !== null && row.sellRate <= maxBuyPrice;
                    return (
                      <TableRow
                        key={gsecKey(row)}
                        className={withinTarget ? 'bg-success/10 hover:bg-success/15' : undefined}
                      >
                        <TableCell className='pl-4 font-medium'>
                          <GsecName listing={row} />
                        </TableCell>
                        <TableCell className='text-center'>{row.bestRrrRank ?? '—'}</TableCell>
                        <TableCell className='text-center'>{row.coupon}</TableCell>
                        <TableCell className='text-center whitespace-nowrap'>
                          {row.maturityDate ? formatBondDate(row.maturityDate) : row.maturityYear}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'bg-red-50/60 text-center dark:bg-red-900/10',
                            withinTarget && 'text-success font-semibold'
                          )}
                        >
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
                        <TableCell className='text-center font-semibold'>
                          {row.rrr === null ? '—' : formatGsecRrr(row.rrr)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'bg-blue-50/60 text-center dark:bg-blue-900/10',
                            withinTarget && 'text-success font-semibold'
                          )}
                        >
                          {maxBuyPrice === null ? '—' : maxBuyPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className='text-center'>
                          {formatNumber(row.analytics?.risk?.modifiedDuration)}
                        </TableCell>
                        <TableCell className='text-center'>{formatMoney(row.analytics?.risk?.dv01, 4)}</TableCell>
                        <TableCell className='text-center'>{formatNumber(row.analytics?.risk?.convexity, 1)}</TableCell>
                        <TableCell className='text-center' title={row.curveUnavailableReason ?? undefined}>
                          {row.curveAnalytics?.spreadBp == null
                            ? '—'
                            : `${row.curveAnalytics.spreadBp > 0 ? '+' : ''}${row.curveAnalytics.spreadBp.toFixed(1)} bp`}
                        </TableCell>
                        <TableCell className='text-center'>
                          <RelativeValue value={row.curveAnalytics?.relativeValue} />
                        </TableCell>
                        <TableCell className='pr-4 text-right'>
                          <BondCardDialog
                            row={row}
                            isLive={isLive}
                            settlementDate={data!.settlementDate}
                            targetYtm={targetYtm}
                            maxBuyPrice={maxBuyPrice}
                            theoreticalTargetPrice={targetPrices.data?.theoreticalPrices?.[gsecKey(row)] ?? null}
                            curve={data?.curve}
                            curvePoints={data?.curvePoints ?? []}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}
