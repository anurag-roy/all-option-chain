import { cn } from '@client/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export const bondTableClassName = 'text-sm tabular-nums [&_th]:text-xs [&_th]:font-semibold';

export function BondCardPanel({
  title,
  icon: Icon,
  headerDetails,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon: LucideIcon;
  headerDetails?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn('bg-card text-card-foreground border-border min-w-0 overflow-hidden rounded-lg border', className)}
    >
      <div className='bg-muted/50 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-inherit px-3 py-2'>
        <h3 className='flex items-center gap-2 text-sm font-semibold'>
          <Icon aria-hidden='true' className='size-4 shrink-0' strokeWidth={2} />
          {title}
        </h3>
        {headerDetails}
      </div>
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function BondCardMetric({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className='flex items-baseline justify-between gap-2 text-xs'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className={cn('shrink-0 text-right font-semibold tabular-nums', highlighted && 'text-success')}>{value}</dd>
    </div>
  );
}
