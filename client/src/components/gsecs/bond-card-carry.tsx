import { BondCardPanel, bondTableClassName } from '@client/components/gsecs/bond-card-panel';
import { formatBondDate, formatMoney, formatPercent } from '@client/components/gsecs/gsec-format';
import { Button } from '@client/components/ui/button';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { cn } from '@client/lib/utils';
import { gsecCarryMonthsSchema } from '@shared/schemas/gsecs';
import type { GsecBondAnalytics, GsecCarry, GsecRow } from '@shared/types/gsecs';
import { LayersIcon, TrendingUpIcon } from 'lucide-react';
import { useId, useState } from 'react';

const formatHorizon = (months: number) => (months % 12 === 0 ? `${months / 12}Y` : `${Number(months.toFixed(6))}M`);

function CustomCarryPlaceholder({ label, pending }: { label: string; pending: boolean }) {
  return (
    <TableRow className='bg-bond-market/10' aria-busy={pending}>
      <TableCell className='font-semibold'>{label}</TableCell>
      {Array.from({ length: 5 }, (_, index) => (
        <TableCell key={index} className='text-muted-foreground text-right'>
          —
        </TableCell>
      ))}
    </TableRow>
  );
}

function MaturityNote({ carry }: { carry: GsecCarry[] }) {
  const horizons = carry.filter((item) => item.maturesBeforeHorizon).map((item) => formatHorizon(item.months));
  return horizons.length ? (
    <p className='text-muted-foreground border-t px-2 py-2 text-xs'>Through maturity at {horizons.join(', ')}</p>
  ) : null;
}

export function BondCardCarry({
  row,
  customMonths,
  onCustomMonths,
  details,
  error,
}: {
  row: GsecRow;
  customMonths: number | null;
  onCustomMonths: (months: number) => void;
  details?: GsecBondAnalytics;
  error?: string;
}) {
  const inputId = useId();
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState<'months' | 'years'>('months');
  const [submitted, setSubmitted] = useState(false);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const months = Number(input) * (unit === 'years' ? 12 : 1);
  const parsed = gsecCarryMonthsSchema.safeParse(input.trim() ? months : NaN);
  const carry = [...(row.analytics?.carry ?? [])];
  const roll = [...(row.curveAnalytics?.carryRoll ?? [])];
  if (details?.customCarry && !carry.some((item) => item.months === customMonths)) carry.push(details.customCarry);
  if (details?.customCarryRoll && !roll.some((item) => item.months === customMonths))
    roll.push(details.customCarryRoll);
  const customPending = customMonths !== null && !details;
  return (
    <>
      <BondCardPanel
        title='Carry at Unchanged YTM'
        icon={LayersIcon}
        tone='market'
        className='@container/carry'
        headerClassName='gap-x-2 @min-[30rem]/carry:flex-nowrap [&_h3]:shrink-0'
        bodyClassName='p-0'
        headerDetails={
          <form
            className='ml-auto flex shrink-0 items-center gap-1'
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              if (parsed.success) {
                setCustomLabel(`${Number(input)}${unit === 'years' ? 'Y' : 'M'}`);
                onCustomMonths(parsed.data);
              }
            }}
          >
            <Label htmlFor={inputId} className='sr-only text-[11px] whitespace-nowrap @min-[34rem]/carry:not-sr-only'>
              Custom Horizon
            </Label>
            <Input
              id={inputId}
              type='number'
              min={0}
              step='any'
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={submitted && !parsed.success}
              aria-describedby={submitted && !parsed.success ? `${inputId}-error` : undefined}
              className='h-7 w-12 [appearance:textfield] px-1.5 text-xs tabular-nums md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
            />
            <select
              aria-label='Custom horizon unit'
              value={unit}
              onChange={(event) => setUnit(event.target.value as 'months' | 'years')}
              className='border-input bg-background focus-visible:outline-ring h-7 w-[4.25rem] rounded-md border px-1 text-xs outline-none focus-visible:outline-2'
            >
              <option value='months'>Months</option>
              <option value='years'>Years</option>
            </select>
            <Button
              type='submit'
              size='xs'
              variant='outline'
              className='border-bond-value/50 h-7 px-1.5 transition-colors'
            >
              Apply
            </Button>
          </form>
        }
      >
        {submitted && !parsed.success ? (
          <p id={`${inputId}-error`} role='alert' className='text-destructive px-3 py-2 text-sm'>
            Enter a horizon of at least one day and at most 100 years.
          </p>
        ) : null}
        {customPending ? (
          <p role='status' className='text-muted-foreground px-3 py-2 text-sm'>
            {error ?? 'Calculating custom horizon…'}
          </p>
        ) : null}
        <Table className={bondTableClassName}>
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
            {carry.length ? (
              carry.map((item) => (
                <TableRow key={item.months} className={cn(item.months === customMonths && 'bg-bond-market/10')}>
                  <TableCell className='font-semibold'>
                    {item.months === customMonths && customLabel ? customLabel : formatHorizon(item.months)}
                  </TableCell>
                  <TableCell>{formatBondDate(item.effectiveHorizonDate)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.couponsReceived, 3)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.redemptionReceived)}</TableCell>
                  <TableCell className='text-right font-semibold'>{formatPercent(item.returnPercent)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                  Carry unavailable.
                </TableCell>
              </TableRow>
            )}
            {customMonths !== null && !carry.some((item) => item.months === customMonths) ? (
              <CustomCarryPlaceholder label={customLabel ?? formatHorizon(customMonths)} pending={customPending} />
            ) : null}
          </TableBody>
        </Table>
        <MaturityNote carry={carry} />
      </BondCardPanel>

      <BondCardPanel
        title='Carry + Roll'
        icon={TrendingUpIcon}
        tone='market'
        bodyClassName='p-0'
        headerDetails={<span className='text-muted-foreground text-xs'>Constant Z-spread</span>}
      >
        <Table className={bondTableClassName}>
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
            {roll.length ? (
              roll.map((item) => (
                <TableRow key={item.months} className={cn(item.months === customMonths && 'bg-bond-market/10')}>
                  <TableCell className='font-semibold'>
                    {item.months === customMonths && customLabel ? customLabel : formatHorizon(item.months)}
                  </TableCell>
                  <TableCell className='text-right'>{formatMoney(item.fairDirtyPrice, 4)}</TableCell>
                  <TableCell className='text-right'>{formatPercent(item.fairYtm)}</TableCell>
                  <TableCell className='text-right'>{formatPercent(item.assumedYtm)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice, 4)}</TableCell>
                  <TableCell className='text-right font-semibold'>{formatPercent(item.returnPercent)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                  {row.curveUnavailableReason ?? 'Carry + roll unavailable.'}
                </TableCell>
              </TableRow>
            )}
            {customMonths !== null && !roll.some((item) => item.months === customMonths) ? (
              <CustomCarryPlaceholder label={customLabel ?? formatHorizon(customMonths)} pending={customPending} />
            ) : null}
          </TableBody>
        </Table>
        <MaturityNote carry={carry} />
      </BondCardPanel>
    </>
  );
}
