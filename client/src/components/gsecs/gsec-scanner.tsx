import { BondCardDialog } from '@client/components/gsecs/bond-card-dialog';
import {
  formatBondDate,
  formatDurationMonths,
  formatMoney,
  formatNumber,
  formatSpread,
} from '@client/components/gsecs/gsec-format';
import { RelativeValue } from '@client/components/gsecs/relative-value';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { useGsecTargetPrices } from '@client/hooks/use-gsec-target-prices';
import { useGsecs } from '@client/hooks/use-gsecs';
import { cn } from '@client/lib/utils';
import { formatGsecRrr } from '@shared/lib/format-gsec-rrr';
import { gsecKey } from '@shared/lib/gsec-key';
import { sortGsecRows, type GsecSort, type GsecSortColumn } from '@shared/lib/sort-gsecs';
import {
  DEFAULT_GSEC_SCENARIO_BASE,
  DEFAULT_GSEC_TARGET_YTM,
  gsecScenarioBaseSchema,
  gsecTargetYtmSchema,
} from '@shared/schemas/gsecs';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';

function SortableHead({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: GsecSortColumn;
  label: string;
  sort: GsecSort;
  onSort: (column: GsecSortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  const nextDescending = active && !sort.descending;
  const Icon = active ? (sort.descending ? ArrowDownIcon : ArrowUpIcon) : ArrowUpDownIcon;

  return (
    <TableHead
      className={cn('text-center', className)}
      aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}
    >
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
  const [scenarioBaseInput, setScenarioBaseInput] = useState(String(DEFAULT_GSEC_SCENARIO_BASE));
  const parsedScenarioBase = gsecScenarioBaseSchema.safeParse(
    scenarioBaseInput.trim() ? Number(scenarioBaseInput) : NaN
  );
  const scenarioBase = parsedScenarioBase.success ? parsedScenarioBase.data : null;
  const { data, error, isPending } = useGsecs(scenarioBase);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<GsecSort>({ column: 'zSpread', descending: false });
  const toggleSort = (column: GsecSortColumn) =>
    setSort((current) => ({ column, descending: current.column === column ? !current.descending : false }));
  const [targetInput, setTargetInput] = useState(String(DEFAULT_GSEC_TARGET_YTM));
  const parsedTarget = gsecTargetYtmSchema.safeParse(targetInput.trim() ? Number(targetInput) : NaN);
  const targetYtm = parsedTarget.success ? parsedTarget.data : null;
  const targetPrices = useGsecTargetPrices(targetYtm, data?.settlementDate, data?.approvedListFetchedAt);
  const rows = sortGsecRows(
    (data?.rows ?? []).filter((row) =>
      `${row.exchange} ${row.tradingsymbol} ${row.isin} ${row.coupon} ${row.maturityYear} ${row.maturityDate}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    ),
    sort,
    targetPrices.data?.prices
  );

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
          <div className='flex items-center gap-2'>
            <Label htmlFor='gsec-scenario-base' className='whitespace-nowrap'>
              Scenario Base (bp)
            </Label>
            <Input
              id='gsec-scenario-base'
              type='number'
              step='any'
              value={scenarioBaseInput}
              onChange={(event) => setScenarioBaseInput(event.target.value)}
              aria-invalid={!parsedScenarioBase.success}
              aria-describedby={!parsedScenarioBase.success ? 'gsec-scenario-error' : undefined}
              className='h-10 w-24 tabular-nums'
            />
          </div>
        </div>

        {!parsedScenarioBase.success ? (
          <p id='gsec-scenario-error' role='alert' className='text-destructive text-sm'>
            Enter a valid scenario base.
          </p>
        ) : null}
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
                  <TableHead className='pl-4 text-left'>G-Sec</TableHead>
                  <SortableHead column='rank' label='RRR Rank' sort={sort} onSort={toggleSort} />
                  <TableHead className='text-center'>Coupon</TableHead>
                  <SortableHead column='maturity' label='Maturity' sort={sort} onSort={toggleSort} />
                  <SortableHead column='buyRate' label='Buy Rate' sort={sort} onSort={toggleSort} />
                  <SortableHead column='ytm' label='RRR (YTM)' sort={sort} onSort={toggleSort} />
                  <SortableHead column='sellRate' label='Sell Rate' sort={sort} onSort={toggleSort} />
                  <SortableHead column='modifiedDuration' label='Mod Dur (mo)' sort={sort} onSort={toggleSort} />
                  <SortableHead column='dv01' label='DV01' sort={sort} onSort={toggleSort} />
                  <SortableHead column='convexity' label='Convexity' sort={sort} onSort={toggleSort} />
                  <SortableHead column='zSpread' label='Z-Spread' sort={sort} onSort={toggleSort} />
                  <SortableHead column='curveSpread' label='Curve Spr.' sort={sort} onSort={toggleSort} />
                  <SortableHead column='relativeValue' label='RV' sort={sort} onSort={toggleSort} />
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
                    const withinTarget =
                      row.analytics !== null &&
                      row.sellRate !== null &&
                      maxBuyPrice !== null &&
                      row.sellRate <= maxBuyPrice;
                    return (
                      <TableRow
                        key={gsecKey(row)}
                        className={withinTarget ? 'bg-success/10 hover:bg-success/15' : undefined}
                      >
                        <TableCell className='pl-4 font-medium'>
                          <BondCardDialog
                            row={row}
                            settlementDate={data!.settlementDate}
                            approvedListFetchedAt={data!.approvedListFetchedAt}
                            targetYtm={targetYtm}
                            maxBuyPrice={maxBuyPrice}
                            theoreticalTargetPrice={targetPrices.data?.theoreticalPrices?.[gsecKey(row)] ?? null}
                            curve={data?.curve}
                            curvePoints={data?.curvePoints ?? []}
                            scenarioBase={scenarioBase}
                            scenariosReady={scenarioBase !== null && data?.scenarioBase === scenarioBase}
                          />
                        </TableCell>
                        <TableCell className='text-center'>{row.bestRrrRank ?? '—'}</TableCell>
                        <TableCell className='text-center'>{row.coupon}</TableCell>
                        <TableCell className='text-center whitespace-nowrap'>
                          {row.maturityDate ? formatBondDate(row.maturityDate) : row.maturityYear}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'bg-blue-50/60 text-center dark:bg-blue-900/10',
                            withinTarget && 'text-success font-semibold'
                          )}
                        >
                          {maxBuyPrice === null ? '—' : maxBuyPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className='text-center font-semibold'>
                          {row.rrr === null ? '—' : formatGsecRrr(row.rrr)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'bg-red-50/60 text-center font-bold dark:bg-red-900/10',
                            withinTarget && 'text-success'
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
                        <TableCell className='text-center'>
                          {formatDurationMonths(row.analytics?.risk?.modifiedDuration)}
                        </TableCell>
                        <TableCell className='text-center'>{formatMoney(row.analytics?.risk?.dv01, 4)}</TableCell>
                        <TableCell className='text-center'>{formatNumber(row.analytics?.risk?.convexity, 1)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-center',
                            row.curveAnalytics?.zSpreadBp != null &&
                              (row.curveAnalytics.zSpreadBp >= 0 ? 'text-success' : 'text-chart-curve')
                          )}
                          title={row.curveUnavailableReason ?? undefined}
                        >
                          {formatSpread(row.curveAnalytics?.zSpreadBp, 2)}
                        </TableCell>
                        <TableCell className='text-center'>{formatSpread(row.curveAnalytics?.spreadBp, 1)}</TableCell>
                        <TableCell className='text-center'>
                          <RelativeValue value={row.curveAnalytics?.relativeValue} />
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
