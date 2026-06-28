import { Button } from '@client/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@client/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/components/ui/tooltip';
import { useNotifications, type Notification } from '@client/contexts/notification-context';
import { cn } from '@client/lib/utils';
import { Bell, Trash2 } from 'lucide-react';
import { useState } from 'react';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div
      className={cn(
        'border-border flex items-start gap-3 border-b px-4 py-3 last:border-b-0',
        notification.type === 'important' && 'bg-amber-500/5 dark:bg-amber-500/10'
      )}
    >
      <span className='text-muted-foreground shrink-0 font-mono text-xs'>[{formatTime(notification.timestamp)}]</span>
      <p className='text-foreground text-sm'>{notification.message}</p>
    </div>
  );
}

export function NotificationCenter() {
  const { notifications, unreadCount, clearNotifications, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      markAllAsRead();
    }
  };

  const triggerButton = (
    <Button variant='ghost' size='icon' className='relative'>
      <Bell className='size-5' />
      {unreadCount > 0 ? (
        <span className='absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger render={<SheetTrigger render={triggerButton} />} />
        <TooltipContent>View notifications</TooltipContent>
      </Tooltip>
      <SheetContent side='right' className='flex w-[500px] flex-col sm:max-w-[500px]'>
        <SheetHeader className='pr-8'>
          <div className='flex items-center justify-between'>
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>{notifications.length} notifications</SheetDescription>
            </div>
            {notifications.length > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant='ghost' size='icon' onClick={clearNotifications} className='size-8'>
                      <Trash2 className='size-4' />
                    </Button>
                  }
                />
                <TooltipContent>Clear all</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </SheetHeader>
        <div className='flex-1 overflow-y-auto'>
          {notifications.length === 0 ? (
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              No notifications yet
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
