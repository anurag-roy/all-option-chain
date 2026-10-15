import { cn } from '@client/lib/utils';
import type { GsecRelativeValue } from '@shared/types/gsec-curve';

export function RelativeValue({ value }: { value: GsecRelativeValue | null | undefined }) {
  if (!value) return <span className='text-muted-foreground'>—</span>;
  return (
    <span
      className={cn(
        'text-xs font-semibold',
        value === 'CHEAP' && 'text-blue-700 dark:text-blue-400',
        value === 'RICH' && 'text-amber-700 dark:text-amber-400',
        value === 'FAIR' && 'text-chart-curve'
      )}
    >
      {value}
    </span>
  );
}
