import { CurveChart } from '@client/components/gsecs/curve-chart';
import {
  formatBondDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from '@client/components/gsecs/gsec-format';
import { GsecName } from '@client/components/gsecs/gsec-name';
import { RelativeValue } from '@client/components/gsecs/relative-value';
import { ScenarioChart } from '@client/components/gsecs/scenario-chart';
import { SellerDepthTable } from '@client/components/gsecs/seller-depth-table';
import { Button } from '@client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { cn } from '@client/lib/utils';
import type { GsecCurvePoint, GsecCurveState } from '@shared/types/gsec-curve';
import type { GsecRow } from '@shared/types/gsecs';
import { useState, type ReactNode } from 'react';

type BondCardProps = {
  row: GsecRow;
  isLive: boolean;
  settlementDate: string;
  targetYtm: number | null;
  maxBuyPrice: number | null;
  theoreticalTargetPrice: number | null;
  curve?: GsecCurveState;
  curvePoints: GsecCurvePoint[];
};

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      <h3 className='bg-muted/50 border-b px-4 py-2.5 font-semibold'>{title}</h3>
      <div className='space-y-3 p-4'>{children}</div>
    </section>
  );
}

function Metric({ label, value, highlighted = false }: { label: string; value: ReactNode; highlighted?: boolean }) {
  return (
    <div className='flex items-baseline justify-between gap-3'>
      <dt className='text-muted-foreground text-sm'>{label}</dt>
      <dd className={cn('text-right font-medium tabular-nums', highlighted && 'text-success')}>{value}</dd>
    </div>
  );
}

function BondCard({
  row,
  isLive,
  settlementDate,
  targetYtm,
  maxBuyPrice,
  theoreticalTargetPrice,
  curve,
  curvePoints,
}: BondCardProps) {
  const analytics = row.analytics;
  const risk = analytics?.risk;
  const annualCarry = analytics?.carry.find((item) => item.months === 12);
  const curveAnalytics = row.curveAnalytics;
  const annualRoll = curveAnalytics?.carryRoll.find((item) => item.months === 12);
  const scenarios = analytics?.scenarios ?? [];
  const withinTarget = row.sellRate !== null && maxBuyPrice !== null && row.sellRate <= maxBuyPrice;
  const quoteMessage = row.quoteStatus === 'unavailable' ? 'Seller quote unavailable.' : 'No sellers available.';
  return (
    <>
      <DialogHeader className='shrink-0 border-b px-6 py-5 pr-14'>
        <DialogTitle className='flex flex-wrap items-center gap-3 text-xl font-semibold'>
          <GsecName listing={row} />
          <span className='text-muted-foreground rounded border px-2 py-0.5 text-xs font-medium'>{row.exchange}</span>
        </DialogTitle>
        <DialogDescription>
          {formatBondDate(row.maturityDate)} · Coupon {(row.coupon / 100).toFixed(2)}% · {row.isin}
        </DialogDescription>
        <p className='text-muted-foreground text-xs'>
          Settlement {formatBondDate(settlementDate)}
          {analytics ? ` · Next coupon ${formatBondDate(analytics.nextCouponDate)}` : ''}
        </p>
      </DialogHeader>

      <div
        role='region'
        aria-label='Bond details'
        tabIndex={0}
        className='focus-visible:ring-ring min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6 outline-none focus-visible:ring-2 focus-visible:ring-inset'
      >
        {!isLive ? (
          <p role='status' className='text-muted-foreground rounded-md border px-3 py-2 text-sm'>
            Live updates disconnected.
          </p>
        ) : null}

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <CardSection title='Market'>
            <dl className='space-y-3'>
              <Metric label='Sell Rate' value={formatMoney(row.sellRate)} highlighted={withinTarget} />
              <Metric label='Current YTM' value={formatPercent(row.rrr)} />
            </dl>
            {row.sellRate === null ? <p className='text-muted-foreground text-xs'>{quoteMessage}</p> : null}
          </CardSection>
          <CardSection title='Target'>
            <dl className='space-y-3'>
              <Metric label='Target YTM' value={formatPercent(targetYtm)} />
              <Metric label='Theoretical price' value={formatMoney(theoreticalTargetPrice, 6)} />
              <Metric label='Buy Rate' value={formatMoney(maxBuyPrice)} highlighted={withinTarget} />
            </dl>
          </CardSection>
          <CardSection title='Risk'>
            <dl className='space-y-3'>
              <Metric
                label='Macaulay duration'
                value={risk ? `${formatNumber(risk.macaulayDuration, 4)} years` : '—'}
              />
              <Metric label='Modified duration' value={formatNumber(risk?.modifiedDuration, 4)} />
              <Metric label='DV01' value={formatMoney(risk?.dv01, 6)} />
              <Metric label='Convexity' value={formatNumber(risk?.convexity, 4)} />
            </dl>
          </CardSection>
          <CardSection title='Relative Value'>
            <dl className='space-y-3'>
              <Metric label='Fair YTM' value={formatPercent(curveAnalytics?.fairYtm)} />
              <Metric
                label='Curve spread'
                value={
                  curveAnalytics?.spreadBp == null
                    ? '—'
                    : `${curveAnalytics.spreadBp > 0 ? '+' : ''}${curveAnalytics.spreadBp.toFixed(2)} bp`
                }
              />
              <Metric label='Curve fair price' value={formatMoney(curveAnalytics?.fairDirtyPrice, 4)} />
              <Metric label='Relative value' value={<RelativeValue value={curveAnalytics?.relativeValue} />} />
              <Metric label='Fair − sell' value={formatMoney(curveAnalytics?.priceAdvantage, 4)} />
            </dl>
          </CardSection>
          <CardSection title='1-Year Carry'>
            <dl className='space-y-3'>
              <Metric label='Unchanged YTM' value={formatPercent(annualCarry?.returnPercent)} />
              <Metric label='Carry + roll' value={formatPercent(annualRoll?.returnPercent)} />
              <Metric label='Roll assumed YTM' value={formatPercent(annualRoll?.assumedYtm)} />
              <Metric label='Roll ending price' value={formatMoney(annualRoll?.endingDirtyPrice, 4)} />
            </dl>
            {annualCarry?.maturesBeforeHorizon ? (
              <p className='text-muted-foreground text-xs'>Through maturity</p>
            ) : null}
          </CardSection>
          <CardSection title='Scenario'>
            <dl className='space-y-3'>
              {[-50, 50].map((shock) => (
                <Metric
                  key={shock}
                  label={`${shock > 0 ? '+' : ''}${shock} bp`}
                  value={formatMoney(scenarios.find((item) => item.shockBp === shock)?.dirtyPrice)}
                />
              ))}
            </dl>
          </CardSection>
        </div>

        <section className='space-y-3'>
          <h3 className='font-semibold'>Carry at unchanged YTM</h3>
          <div className='overflow-hidden rounded-lg border'>
            <Table className='tabular-nums'>
              <TableHeader>
                <TableRow>
                  <TableHead>Horizon</TableHead>
                  <TableHead>Value date</TableHead>
                  <TableHead className='text-right'>Ending price</TableHead>
                  <TableHead className='text-right'>Coupons</TableHead>
                  <TableHead className='text-right'>Redemption</TableHead>
                  <TableHead className='text-right'>Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.carry.map((item) => (
                  <TableRow key={item.months}>
                    <TableCell>{item.months === 12 ? '1Y' : `${item.months}M`}</TableCell>
                    <TableCell>
                      {formatBondDate(item.effectiveHorizonDate)}
                      {item.maturesBeforeHorizon ? (
                        <span className='text-muted-foreground ml-2 text-xs'>Maturity</span>
                      ) : null}
                    </TableCell>
                    <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice)}</TableCell>
                    <TableCell className='text-right'>{formatMoney(item.couponsReceived, 3)}</TableCell>
                    <TableCell className='text-right'>{formatMoney(item.redemptionReceived)}</TableCell>
                    <TableCell className='text-right font-medium'>{formatPercent(item.returnPercent)}</TableCell>
                  </TableRow>
                )) ?? (
                  <TableRow>
                    <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                      Carry unavailable.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className='space-y-3'>
          <h3 className='font-semibold'>Carry + roll</h3>
          <div className='overflow-hidden rounded-lg border'>
            <Table className='tabular-nums'>
              <TableHeader>
                <TableRow>
                  <TableHead>Horizon</TableHead>
                  <TableHead className='text-right'>Fair price</TableHead>
                  <TableHead className='text-right'>Fair YTM</TableHead>
                  <TableHead className='text-right'>Assumed YTM</TableHead>
                  <TableHead className='text-right'>Ending price</TableHead>
                  <TableHead className='text-right'>Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {curveAnalytics?.carryRoll.length ? (
                  curveAnalytics.carryRoll.map((item) => (
                    <TableRow key={item.months}>
                      <TableCell>{item.months === 12 ? '1Y' : `${item.months}M`}</TableCell>
                      <TableCell className='text-right'>{formatMoney(item.fairDirtyPrice, 4)}</TableCell>
                      <TableCell className='text-right'>{formatPercent(item.fairYtm)}</TableCell>
                      <TableCell className='text-right'>{formatPercent(item.assumedYtm)}</TableCell>
                      <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice, 4)}</TableCell>
                      <TableCell className='text-right font-medium'>{formatPercent(item.returnPercent)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                      {row.curveUnavailableReason ?? 'Carry + roll unavailable.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className='space-y-3'>
          <h3 className='font-semibold'>Yield shock scenarios</h3>
          <div className='grid items-center gap-4 lg:grid-cols-2'>
            <div className='overflow-hidden rounded-lg border'>
              <Table className='tabular-nums'>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shock</TableHead>
                    <TableHead className='text-right'>YTM</TableHead>
                    <TableHead className='text-right'>Dirty price</TableHead>
                    <TableHead className='text-right'>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scenarios.length ? (
                    scenarios.map((item) => (
                      <TableRow key={item.shockBp} className={item.shockBp === 0 ? 'bg-muted/50' : undefined}>
                        <TableCell>
                          {item.shockBp > 0 ? '+' : ''}
                          {item.shockBp} bp
                        </TableCell>
                        <TableCell className='text-right'>{formatPercent(item.yieldPercent)}</TableCell>
                        <TableCell className='text-right'>{formatMoney(item.dirtyPrice)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right',
                            item.priceChangePercent !== null &&
                              item.priceChangePercent < 0 &&
                              'text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {formatSignedPercent(item.priceChangePercent)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='text-muted-foreground py-6 text-center'>
                        Scenarios unavailable.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScenarioChart scenarios={scenarios} />
          </div>
        </section>

        <section className='space-y-3 rounded-lg border p-4'>
          <h3 className='font-semibold'>Curve</h3>
          {curveAnalytics && curve?.snapshot ? (
            <>
              <p className='text-muted-foreground text-sm'>
                <a
                  href={curve.snapshot.sourceUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='underline underline-offset-4'
                >
                  CCIL NSS
                </a>
                {' · '}
                {formatBondDate(curve.snapshot.referenceDate)}
              </p>
              <CurveChart points={curvePoints} analytics={curveAnalytics} marketYtm={row.rrr} />
              {curve.message ? <p className='text-muted-foreground text-xs'>{curve.message}</p> : null}
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>{row.curveUnavailableReason ?? 'CCIL curve unavailable.'}</p>
          )}
        </section>

        <section className='space-y-3'>
          <h3 className='font-semibold'>Seller depth</h3>
          <SellerDepthTable row={row} />
        </section>
      </div>
    </>
  );
}

export function BondCardDialog(props: BondCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant='outline' size='sm' className='min-h-10 transition-colors' />}
        aria-label={`Open Bond Card for ${props.row.exchange} ${props.row.tradingsymbol}`}
      >
        Bond Card
      </DialogTrigger>
      <DialogContent
        initialFocus={false}
        className='flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl'
      >
        {open ? <BondCard {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}
