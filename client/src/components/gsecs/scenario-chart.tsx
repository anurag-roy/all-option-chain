import { formatMoney, formatPercent, formatSignedPercent } from '@client/components/gsecs/gsec-format';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@client/components/ui/chart';
import type { GsecScenario } from '@shared/types/gsecs';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

const chartConfig = {
  dirtyPrice: { label: 'Dirty price', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const formatShock = (bp: number) => `${bp > 0 ? '+' : ''}${bp} bp`;

/** Plot server-calculated prices; no pricing or yield calculation in the browser. */
export function ScenarioChart({ scenarios }: { scenarios: GsecScenario[] }) {
  const points = scenarios.filter((row) => row.dirtyPrice !== null);
  if (points.length < 2) return null;
  const prices = points.map((row) => row.dirtyPrice!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = Math.max((max - min) * 0.1, 0.01);

  return (
    <div className='bg-card min-w-0 rounded-lg border p-4'>
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-64 w-full tabular-nums'
        aria-label='Bond dirty price at annual yield shocks from minus 100 to plus 100 basis points'
      >
        <LineChart accessibilityLayer data={points} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='shockBp'
            type='number'
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tickFormatter={formatShock}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={8}
          />
          <YAxis
            domain={[min - padding, max + padding]}
            tickFormatter={(price: number) => formatMoney(price)}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={72}
            tickCount={5}
          />
          <ReferenceLine x={0} stroke='var(--border)' strokeDasharray='4 4' />
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                className='min-w-48 tabular-nums'
                labelFormatter={(_label, payload) => formatShock(payload[0].payload.shockBp)}
                formatter={(_value, _name, item) => {
                  const scenario = item.payload as GsecScenario;
                  return (
                    <dl className='grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-2'>
                      <dt className='text-muted-foreground'>Dirty price</dt>
                      <dd className='text-right font-medium'>{formatMoney(scenario.dirtyPrice, 4)}</dd>
                      <dt className='text-muted-foreground'>YTM</dt>
                      <dd className='text-right font-medium'>{formatPercent(scenario.yieldPercent)}</dd>
                      <dt className='text-muted-foreground'>Price change</dt>
                      <dd className='text-right font-medium'>{formatSignedPercent(scenario.priceChangePercent)}</dd>
                    </dl>
                  );
                }}
              />
            }
          />
          <Line
            dataKey='dirtyPrice'
            type='monotone'
            stroke='var(--color-dirtyPrice)'
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-dirtyPrice)', stroke: 'var(--card)', strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
