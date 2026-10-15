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
  const gapPercent =
    priceGap !== null && maxBuyPrice !== null && maxBuyPrice > 0 ? (priceGap * 100) / maxBuyPrice : null;
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
            ? 'BUY ZONE'
            : 'WAIT';

  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
      <BondCardPanel title='Decision' icon={ScaleIcon} tone={withinTarget ? 'target' : 'decision'}>
        <div className='flex h-full min-h-36 flex-col gap-3'>
          <div
            className={cn(
              'bg-muted border-border rounded-lg border px-3 py-3 text-center text-lg font-bold',
              waiting && 'border-chart-curve/60 bg-chart-curve text-foreground dark:text-background',
              withinTarget && 'border-success/40 bg-success text-primary-foreground dark:text-background'
            )}
          >
            {decision}
          </div>
          <dl className='space-y-3'>
            <Metric label='Sell Rate' value={formatMoney(row.sellRate)} />
            <Metric label='Buy Rate' value={formatMoney(maxBuyPrice)} highlighted={withinTarget} />
            <div className='border-border border-t pt-3'>
              <Metric
                label='Gap to buy'
                value={
                  <span className={cn(waiting && 'text-destructive', withinTarget && 'text-success')}>
                    {formatMoney(priceGap)}
                    {gapPercent === null ? '' : ` (${formatPercent(gapPercent, 2)})`}
                  </span>
                }
              />
            </div>
          </dl>
        </div>
      </BondCardPanel>

      <BondCardPanel title='Risk' icon={ShieldIcon} tone='risk'>
        <dl className='space-y-3'>
          <Metric label='Macaulay duration' value={risk ? `${formatNumber(risk.macaulayDuration, 4)} yr` : '—'} />
          <Metric
            label='Modified duration'
            value={
              risk ? (
                <>
                  {formatNumber(risk.modifiedDuration, 4)} yr
                  <span className='text-muted-foreground mt-1 block text-xs font-normal'>
                    {formatDurationMonths(risk.modifiedDuration, 4)} months
                  </span>
                </>
              ) : (
                '—'
              )
            }
          />
        </dl>
        <dl className='border-border mt-3 space-y-3 border-t pt-3'>
          <Metric label='DV01' value={formatMoney(risk?.dv01, 6)} />
          <Metric label='Convexity' value={formatNumber(risk?.convexity, 4)} />
        </dl>
      </BondCardPanel>

      <BondCardPanel title='Relative Value' icon={ChartNoAxesColumnIncreasingIcon} tone='value'>
        <dl className='space-y-3'>
          <Metric label='Curve fair price' value={formatMoney(curve?.fairDirtyPrice, 4)} />
          <div className='bg-bond-value/10 -mx-1 rounded px-1 py-1'>
            <Metric label='Fair YTM' value={<span className='text-bond-value'>{formatPercent(curve?.fairYtm)}</span>} />
          </div>
          <Metric
            label='Z-spread'
            value={
              <span
                className={cn(curve?.zSpreadBp != null && (curve.zSpreadBp >= 0 ? 'text-success' : 'text-chart-curve'))}
              >
                {formatSpread(curve?.zSpreadBp)}
              </span>
            }
          />
          <Metric
            label='YTM spread'
            value={
              <span
                className={cn(curve?.spreadBp != null && (curve.spreadBp >= 0 ? 'text-success' : 'text-chart-curve'))}
              >
                {formatSpread(curve?.spreadBp)}
              </span>
            }
          />
          <Metric label='Relative value' value={<RelativeValue value={curve?.relativeValue} />} />
          <Metric label='Fair − sell' value={formatMoney(curve?.priceAdvantage, 4)} />
        </dl>
      </BondCardPanel>

      <BondCardPanel title='Market' icon={TrendingUpIcon} tone='market'>
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

      <BondCardPanel title='Target' icon={TargetIcon} tone='target'>
        <dl className='divide-border divide-y [&>div]:py-3 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0'>
          <Metric label='Target YTM' value={formatPercent(targetYtm)} />
          <Metric label='Theoretical price' value={formatMoney(theoreticalTargetPrice, 6)} />
          <Metric label='Buy Rate' value={<span className='text-success'>{formatMoney(maxBuyPrice)}</span>} />
        </dl>
      </BondCardPanel>
    </div>
  );
}
