import { Avatar, AvatarFallback } from '@client/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@client/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@client/components/ui/tooltip';
import { useTheme } from '@client/hooks/use-theme';
import { useUserProfile } from '@client/hooks/use-user-profile';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertCircleIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  SunMoonIcon,
  XIcon,
} from 'lucide-react';

function getUserInitials(name: string) {
  const nameParts = name.split(' ').filter(Boolean);
  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }
  return nameParts[0].slice(0, 1).toUpperCase() + nameParts[1].slice(0, 1).toUpperCase();
}

interface UserButtonProps {
  isConnected: boolean;
}

export function UserButton({ isConnected }: UserButtonProps) {
  const navigate = useNavigate();
  const { data: userProfile, isLoading, isError } = useUserProfile();
  const { theme, setTheme } = useTheme();

  if (isLoading) {
    return <Loader2Icon className='size-4 animate-spin' />;
  }

  if (isError) {
    return (
      <Tooltip>
        <TooltipTrigger render={<AlertCircleIcon className='text-destructive size-4' />} />
        <TooltipContent>Error fetching user details</TooltipContent>
      </Tooltip>
    );
  }

  const nameInitials = getUserInitials(userProfile?.user_name || 'User');

  const UserAvatar = ({ showStatus = false }: { showStatus?: boolean }) => (
    <div className='relative'>
      <Avatar className='size-8 rounded-full'>
        <AvatarFallback className='rounded-full text-sm'>{nameInitials}</AvatarFallback>
      </Avatar>
      {showStatus ? (
        isConnected ? (
          <span className='border-background absolute -bottom-0.5 -left-0.5 flex size-3 items-center justify-center rounded-full border-2 bg-emerald-500' />
        ) : (
          <span className='border-background absolute -bottom-0.5 -left-0.5 flex size-3.5 items-center justify-center rounded-full border-2 bg-red-500'>
            <XIcon className='size-2 text-white' strokeWidth={3} />
          </span>
        )
      ) : null}
    </div>
  );

  const avatarWithStatus = <UserAvatar showStatus />;
  const menuTrigger = <DropdownMenuTrigger className='rounded-full'>{avatarWithStatus}</DropdownMenuTrigger>;

  return (
    <DropdownMenu>
      {isConnected ? (
        menuTrigger
      ) : (
        <Tooltip>
          <TooltipTrigger render={menuTrigger} />
          <TooltipContent>Disconnected from server</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent className='w-48 max-w-48 rounded-lg' side='bottom' align='end' sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='p-0 font-normal'>
            <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
              <UserAvatar />
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>{userProfile?.user_id}</span>
                <span className='truncate text-xs'>{userProfile?.user_name}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className='gap-2'>
            <SunMoonIcon className='text-muted-foreground size-4' />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                className='gap-2'
                checked={theme === 'light'}
                onCheckedChange={() => setTheme('light')}
              >
                <SunIcon className='text-muted-foreground size-4' />
                Light
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className='gap-2'
                checked={theme === 'dark'}
                onCheckedChange={() => setTheme('dark')}
              >
                <MoonIcon className='text-muted-foreground size-4' />
                Dark
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                className='gap-2'
                checked={theme === 'system'}
                onCheckedChange={() => setTheme('system')}
              >
                <MonitorIcon className='text-muted-foreground size-4' />
                System
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem className='gap-2' onClick={() => navigate({ to: '/amo' })}>
          <ArrowUpRightIcon className='text-muted-foreground size-4' />
          Place AMO
        </DropdownMenuItem>
        <DropdownMenuItem className='gap-2' onClick={() => navigate({ to: '/settings' })}>
          <SettingsIcon className='text-muted-foreground size-4' />
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
