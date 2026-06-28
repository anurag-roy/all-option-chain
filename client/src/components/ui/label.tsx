import * as React from 'react';
import { cn } from '@client/lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-sm leading-none font-medium', className)} {...props} />
  )
);
Label.displayName = 'Label';
