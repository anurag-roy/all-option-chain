import { formatMoney, formatPercent, formatSignedPercent } from '@client/components/gsecs/gsec-format';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@client/components/ui/chart';
import type { GsecScenario } from '@shared/types/gsecs';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

const chartConfig = {
  dirtyPrice: { label: 'Dirty price', color: 'var(--bond-market)' },
} satisfies ChartConfig;

const formatShock = (bp: number) => `${bp > 0 ? '+' : ''}${bp} bp`;

/** Plot server-calculated prices; no pricing or yield calculation in the browser. */
export function ScenarioChart({ scenarios, scenarioBase }: { scenarios: GsecScenario[]; scenarioBase: number }) {
  const points = scenarios.filter((row) => row.dirtyPrice !== null);
  if (points.length < 2) return null;
  const prices = points.map((row) => row.dirtyPrice!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = Math.max((max - min) * 0.1, 0.01);
  const shocks = scenarios.map((row) => row.shockBp);

  return (
    <div className='min-w-0'>
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-80 w-full text-xs tabular-nums lg:h-96'
        aria-label='Bond dirty price at the configured annual yield shocks'
      >
        <LineChart accessibilityLayer data={scenarios} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis
            dataKey='shockBp'
            type='number'
            domain={[Math.min(...shocks), Math.max(...shocks)]}
            tickCount={5}
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
            width={80}
            tickCount={5}
          />
          <ReferenceLine x={scenarioBase} stroke='var(--border)' strokeDasharray='4 4' />
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                className='min-w-48 text-sm tabular-nums'
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
      <p className='text-muted-foreground pb-1 text-center text-xs'>Yield shock (bp)</p>
    </div>
  );
}
