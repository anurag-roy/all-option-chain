import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertCircleIcon } from 'lucide-react';

interface DisplayErrorProps {
  title?: string;
  message?: string;
}

export function DisplayError({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
}: DisplayErrorProps) {
  return (
    <div className='flex min-h-[400px] items-center justify-center'>
      <div className='text-center'>
        <AlertCircleIcon className='text-destructive mx-auto mb-4 h-12 w-12' />
        <h3 className='text-lg font-semibold'>{title}</h3>
        <p className='text-muted-foreground'>{message}</p>
      </div>
    </div>
  );
}

// Router-specific error component that matches TanStack Router's expected interface
export function RouterError({ error }: ErrorComponentProps) {
  const title = error?.name || 'Something went wrong';
  const message = error?.message || 'An unexpected error occurred. Please try again.';

  return <DisplayError title={title} message={message} />;
}
