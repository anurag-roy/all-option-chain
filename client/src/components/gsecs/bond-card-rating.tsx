import { BondCardPanel, bondTableClassName } from '@client/components/gsecs/bond-card-panel';
import { formatNumber, formatPercent, formatSignedPercent, formatSpread } from '@client/components/gsecs/gsec-format';
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
import type { GsecOpportunityRating, GsecRatingColor, GsecRatingFactor } from '@shared/types/gsec-rating';
import { ArrowRightIcon, StarIcon } from 'lucide-react';
import { useRef } from 'react';

const ratingStyles: Record<GsecRatingColor, string> = {
  red: 'text-destructive border-destructive/50',
  orange: 'text-rating-orange border-rating-orange/50',
  yellow: 'text-chart-curve border-chart-curve/50',
  green: 'text-success border-success/50',
  blue: 'text-bond-market border-bond-market/50',
};

function actualValue(factor: GsecRatingFactor) {
  if (factor.actual === null) return '—';
  if (factor.id === 'target' || factor.id === 'value') return formatSpread(factor.actual);
  if (factor.id === 'carry')
    return `${formatPercent(factor.actual)} (${formatPercent(factor.ratioPercent, 2)} of target)`;
  return `${formatSignedPercent(factor.actual)} at +80 bp`;
}

function Takeaway({ factors }: { factors: GsecRatingFactor[] }) {
  const [target, value, carry, sensitivity] = factors;
  if (factors.some((factor) => factor.score === null)) return null;
  const strong = (color: GsecRatingColor | null) => color === 'blue' || color === 'green';
  return (
    <p className='text-muted-foreground text-sm text-pretty'>
      {target.color === 'blue' ? 'Meets the yield target' : 'Below the yield target'};{' '}
      {value.color === 'yellow'
        ? 'approximately fair curve value'
        : strong(value.color)
          ? 'attractive curve value'
          : 'rich versus the curve'}
      ; {strong(carry.color) ? 'strong' : carry.color === 'yellow' ? 'fair' : 'weak'} carry;{' '}
      {strong(sensitivity.color) ? 'low' : sensitivity.color === 'yellow' ? 'moderate' : 'high'} rate sensitivity.
    </p>
  );
}

export function BondCardRating({
  rating,
  symbol,
  error,
}: {
  rating?: GsecOpportunityRating;
  symbol: string;
  error?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const colorStyle = rating?.color ? ratingStyles[rating.color] : '';
  return (
    <BondCardPanel title='Rating' icon={StarIcon} tone='value' className={cn(colorStyle, 'text-card-foreground')}>
      <Dialog>
        <DialogTrigger
          render={
            <button
              type='button'
              className={cn(
                'focus-visible:outline-ring w-full cursor-pointer space-y-2 rounded-lg border px-3 py-4 text-center outline-none focus-visible:outline-2',
                colorStyle
              )}
            />
          }
          disabled={!rating}
          aria-label={`Rating breakdown for ${symbol}`}
        >
          <div className='text-3xl font-bold tabular-nums'>
            {formatNumber(rating?.score)} <span className='text-foreground text-sm font-medium'>/ 100</span>
          </div>
          <div className='text-sm font-semibold'>{rating?.label ?? (error ? 'Unavailable' : 'Calculating…')}</div>
        </DialogTrigger>
        <dl className='divide-border mt-3 divide-y'>
          {rating?.factors.map((factor) => (
            <div key={factor.id} className='flex items-center justify-between gap-3 py-3 text-sm'>
              <dt className={cn('flex items-center gap-2', factor.color && ratingStyles[factor.color])}>
                <span aria-hidden='true' className='size-2.5 shrink-0 rounded-full bg-current' />
                <span className='text-muted-foreground'>
                  {factor.label} ({factor.weight}%)
                </span>
              </dt>
              <dd className='font-semibold tabular-nums'>{formatNumber(factor.score)}</dd>
            </div>
          ))}
        </dl>
        {error || rating?.unavailableReason ? (
          <p className='text-muted-foreground mt-3 text-sm'>{error ?? rating?.unavailableReason}</p>
        ) : null}
        <DialogTrigger
          render={<Button variant='outline' className='border-bond-value/50 mt-3 min-h-10 w-full transition-colors' />}
          disabled={!rating}
        >
          View Full Breakdown <ArrowRightIcon aria-hidden='true' />
        </DialogTrigger>
        <DialogContent
          initialFocus={titleRef}
          overlayProps={{ forceRender: true }}
          className='flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-4xl'
        >
          <DialogHeader className='pr-10'>
            <DialogTitle ref={titleRef} tabIndex={-1} className='outline-none'>
              Rating Breakdown
            </DialogTitle>
            <DialogDescription>{symbol}</DialogDescription>
          </DialogHeader>
          <div className='min-h-0 space-y-4 overflow-y-auto'>
            <Table className={bondTableClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead>Actual Value</TableHead>
                  <TableHead>Raw Color</TableHead>
                  <TableHead className='text-right'>Score</TableHead>
                  <TableHead className='text-right'>Weight</TableHead>
                  <TableHead className='text-right'>Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rating?.factors.map((factor) => (
                  <TableRow key={factor.id}>
                    <TableCell className='font-medium'>{factor.label}</TableCell>
                    <TableCell>{actualValue(factor)}</TableCell>
                    <TableCell className={cn('font-semibold capitalize', factor.color && ratingStyles[factor.color])}>
                      {factor.color ?? '—'}
                    </TableCell>
                    <TableCell className='text-right'>{formatNumber(factor.score)}</TableCell>
                    <TableCell className='text-right'>{factor.weight}%</TableCell>
                    <TableCell className='text-right'>{formatNumber(factor.contribution)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className='bg-muted/50 font-semibold'>
                  <TableCell colSpan={4}>Overall Rating</TableCell>
                  <TableCell className='text-right'>100%</TableCell>
                  <TableCell className={cn('text-right', colorStyle)}>{formatNumber(rating?.score)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {rating?.score !== null && rating ? (
              <Takeaway factors={rating.factors} />
            ) : (
              <p className='text-muted-foreground text-sm'>{rating?.unavailableReason}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </BondCardPanel>
  );
}
