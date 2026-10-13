import { BondCardPanel, BondCardMetric as Metric } from '@client/components/gsecs/bond-card-panel';
import {
  formatDurationMonths,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSpread,
} from '@client/components/gsecs/gsec-format';
import { RelativeValue } from '@client/components/gsecs/relative-value';
import { cn } from '@client/lib/utils';
import type { GsecRow } from '@shared/types/gsecs';
import { ChartNoAxesColumnIncreasingIcon, ScaleIcon, ShieldIcon, TargetIcon, TrendingUpIcon } from 'lucide-react';

export function BondCardSummary({
  row,
  targetYtm,
  maxBuyPrice,
  theoreticalTargetPrice,
}: {
  row: GsecRow;
  targetYtm: number | null;
  maxBuyPrice: number | null;
  theoreticalTargetPrice: number | null;
}) {
  const risk = row.analytics?.risk;
  const curve = row.curveAnalytics;
  const withinTarget =
    row.analytics !== null && row.sellRate !== null && maxBuyPrice !== null && row.sellRate <= maxBuyPrice;
  const waiting = row.analytics !== null && row.sellRate !== null && maxBuyPrice !== null && !withinTarget;
  const priceGap = row.sellRate === null || maxBuyPrice === null ? null : maxBuyPrice - row.sellRate;
  const decision =
    row.sellRate === null
      ? row.quoteStatus === 'unavailable'
        ? 'UNAVAILABLE'
        : 'NO SELLER'
      : !row.analytics
        ? 'INVALID'
        : maxBuyPrice === null
          ? '—'
          : withinTarget
            ? 'BUY ELIGIBLE'
            : 'WAIT';

  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
      <BondCardPanel title='Market' icon={TrendingUpIcon}>
        <dl className='space-y-3'>
          <div className='border-border border-b pb-3'>
            <dt className='text-muted-foreground text-xs'>Sell Rate</dt>
            <dd className={cn('mt-1 text-2xl font-semibold tabular-nums', withinTarget && 'text-success')}>
              {formatMoney(row.sellRate)}
            </dd>
          </div>
          <div>
            <dt className='text-muted-foreground text-xs'>Current YTM</dt>
            <dd className='mt-1 text-2xl font-semibold tabular-nums'>{formatPercent(row.rrr)}</dd>
          </div>
        </dl>
      </BondCardPanel>

      <BondCardPanel title='Target' icon={TargetIcon}>
        <dl className='divide-border divide-y [&>div]:py-3 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0'>
          <Metric label='Target YTM' value={formatPercent(targetYtm)} />
          <Metric label='Theoretical price' value={formatMoney(theoreticalTargetPrice, 6)} />
          <Metric label='Buy Rate' value={formatMoney(maxBuyPrice)} highlighted={withinTarget} />
        </dl>
      </BondCardPanel>

      <BondCardPanel
        title='Decision'
        icon={ScaleIcon}
        className={cn(
          waiting && 'border-chart-curve/50 bg-chart-curve/5 [&_h3_svg]:text-chart-curve',
          withinTarget && 'border-success/40 bg-success/5 [&_h3_svg]:text-success'
        )}
      >
        <div className='flex h-full min-h-36 flex-col justify-between gap-3'>
          <div className='space-y-2 text-center'>
            <div
              className={cn(
                'bg-muted border-border rounded-lg border px-3 py-3 text-lg font-bold tabular-nums',
                waiting && 'border-chart-curve/60 bg-chart-curve text-foreground dark:text-background',
                withinTarget && 'border-success/40 bg-success text-primary-foreground dark:text-background'
              )}
            >
              {decision}
            </div>
            {waiting || withinTarget ? (
              <p className={cn('text-xs', waiting ? 'text-chart-curve' : 'text-success')}>
                {waiting ? 'Sell above buy rate' : 'Within buy rate'}
              </p>
            ) : null}
          </div>
          <dl className={cn('border-t pt-3', waiting ? 'border-chart-curve/30' : 'border-border')}>
            <Metric
              label='Gap to buy'
              value={<span className={cn('text-lg', waiting && 'text-chart-curve')}>{formatMoney(priceGap)}</span>}
              highlighted={withinTarget}
            />
          </dl>
        </div>
      </BondCardPanel>

      <BondCardPanel title='Risk' icon={ShieldIcon}>
        <dl className='space-y-2'>
          <Metric label='Macaulay duration' value={risk ? `${formatNumber(risk.macaulayDuration, 4)} yr` : '—'} />
          <Metric
            label='Modified duration'
            value={
              risk ? (
                <>
                  {formatNumber(risk.modifiedDuration, 4)} yr
                  <span className='text-muted-foreground mt-1 block font-normal'>
                    {formatDurationMonths(risk.modifiedDuration, 4)} months
                  </span>
                </>
              ) : (
                '—'
              )
            }
          />
        </dl>
        <dl className='border-border mt-3 space-y-2 border-t pt-3'>
          <Metric label='DV01' value={formatMoney(risk?.dv01, 6)} />
          <Metric label='Convexity' value={formatNumber(risk?.convexity, 4)} />
        </dl>
      </BondCardPanel>

      <BondCardPanel
        title='Relative Value'
        icon={ChartNoAxesColumnIncreasingIcon}
        className='sm:col-span-2 lg:col-span-2 xl:col-span-1'
      >
        <dl className='space-y-2'>
          <Metric label='Curve fair price' value={formatMoney(curve?.fairDirtyPrice, 4)} />
          <Metric label='Fair YTM' value={formatPercent(curve?.fairYtm)} />
          <Metric label='Z-spread' value={formatSpread(curve?.zSpreadBp)} />
          <Metric label='YTM spread' value={formatSpread(curve?.spreadBp)} />
          <Metric
            label='Relative value'
            value={
              curve?.relativeValue ? (
                <span className='bg-muted/30 rounded border px-1.5 py-0.5'>
                  <RelativeValue value={curve.relativeValue} />
                </span>
              ) : (
                '—'
              )
            }
          />
          <Metric label='Fair − sell' value={formatMoney(curve?.priceAdvantage, 4)} />
        </dl>
      </BondCardPanel>
    </div>
  );
}
