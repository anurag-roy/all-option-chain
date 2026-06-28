import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@client/components/ui/card';
import { Link } from '@tanstack/react-router';
import { XCircleIcon } from 'lucide-react';

export function NotFound() {
  return (
    <div className='flex h-full items-center justify-center'>
      <Card className='w-full max-w-lg py-12'>
        <CardHeader className='pb-8'>
          <CardTitle className='text-destructive flex items-center justify-center text-4xl font-bold'>
            <XCircleIcon className='mr-2' size={36} />
            404 - Not Found
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-1 text-center'>
          <p>Oops! The page you're looking for doesn't exist.</p>
          <p className='text-muted-foreground text-sm'>It might have been moved or deleted.</p>
        </CardContent>
        <CardFooter className='flex justify-center pt-8'>
          <Button render={<Link to='/'>Go back home</Link>} />
        </CardFooter>
      </Card>
    </div>
  );
}
