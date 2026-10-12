import { formatPercent } from '@client/components/gsecs/gsec-format';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@client/components/ui/chart';
import type { GsecCurveAnalytics, GsecCurvePoint } from '@shared/types/gsec-curve';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

const chartConfig = {
  zeroRate: { label: 'CCIL zero rate', color: 'var(--chart-curve)' },
  fairYtm: { label: 'Bond fair YTM', color: 'var(--muted-foreground)' },
  marketYtm: { label: 'Market YTM', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type CurveDatum = {
  tenor: number;
  zeroRate: number | null;
  fairYtm: number | null;
  marketYtm: number | null;
};

/** Coordinates only: all rates and bond yields are calculated on the server. */
export function CurveChart({
  points,
  analytics,
  marketYtm,
}: {
  points: GsecCurvePoint[];
  analytics: GsecCurveAnalytics;
  marketYtm: number | null;
}) {
  const start = Math.max(points[0]?.tenor ?? 0, analytics.maturityTenor - 5);
  const end = Math.min(points.at(-1)?.tenor ?? 50, analytics.maturityTenor + 5);
  const local = points.filter((point) => point.tenor >= start && point.tenor <= end);
  if (local.length < 2) return null;

  // Insert the selected bond as its own point without substituting its fair YTM for a zero rate.
  const data: CurveDatum[] = local.map((point) => ({ ...point, fairYtm: null, marketYtm: null }));
  const selected = data.find((point) => point.tenor === analytics.maturityTenor);
  if (selected) {
    selected.fairYtm = analytics.fairYtm;
    selected.marketYtm = marketYtm;
  } else {
    data.push({ tenor: analytics.maturityTenor, zeroRate: null, fairYtm: analytics.fairYtm, marketYtm });
    data.sort((a, b) => a.tenor - b.tenor);
  }
  const values = [
    ...local.map((point) => point.zeroRate),
    analytics.fairYtm,
    ...(marketYtm === null ? [] : [marketYtm]),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 0.05);

  return (
    <div className='min-w-0 space-y-2'>
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-80 w-full tabular-nums'
        aria-label='Local CCIL zero curve with selected bond market and fair YTM highlighted'
      >
        <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='tenor'
            type='number'
            domain={[start, end]}
            tickFormatter={(tenor: number) => `${tenor.toFixed(1)}y`}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={20}
            tickCount={6}
          />
          <YAxis
            domain={[min - padding, max + padding]}
            tickFormatter={(rate: number) => formatPercent(rate, 2)}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={68}
            tickCount={5}
          />
          <ReferenceLine x={analytics.maturityTenor} stroke='var(--border)' strokeDasharray='4 4' />
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                className='min-w-56 tabular-nums'
                labelFormatter={(_label, payload) => `${payload[0].payload.tenor.toFixed(2)} years remaining`}
                formatter={(value, name, item) => (
                  <>
                    <span className='size-2.5 shrink-0 rounded-sm' style={{ backgroundColor: item.color }} />
                    <span className='text-muted-foreground flex-1'>
                      {chartConfig[name as keyof typeof chartConfig]?.label}
                    </span>
                    <span className='font-medium'>{formatPercent(typeof value === 'number' ? value : null)}</span>
                  </>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent className='text-muted-foreground flex-wrap gap-x-5 gap-y-2' />} />
          <Line
            dataKey='zeroRate'
            type='monotone'
            connectNulls
            stroke='var(--color-zeroRate)'
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey='fairYtm'
            stroke='var(--color-fairYtm)'
            strokeWidth={0}
            dot={{ r: 5, fill: 'var(--card)', stroke: 'var(--color-fairYtm)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--card)', stroke: 'var(--color-fairYtm)', strokeWidth: 2 }}
            legendType='circle'
            isAnimationActive={false}
          />
          {marketYtm !== null ? (
            <Line
              dataKey='marketYtm'
              stroke='var(--color-marketYtm)'
              strokeWidth={0}
              dot={{ r: 4, fill: 'var(--color-marketYtm)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }}
              legendType='circle'
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ChartContainer>
      <p className='text-muted-foreground text-center text-xs'>Remaining maturity (years)</p>
    </div>
  );
}
