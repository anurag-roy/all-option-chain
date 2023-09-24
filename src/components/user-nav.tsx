import type { UserDetails } from '@/types/shoonya';
import { ArrowTopRightIcon } from '@radix-ui/react-icons';
import ky from 'ky';
import Link from 'next/link';
import * as React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function UserNav() {
  const [userDetails, setUserDetails] = React.useState<UserDetails | null>(
    null
  );
  React.useEffect(() => {
    ky.get('/api/userDetails').json<UserDetails>().then(setUserDetails);
  }, []);

  return userDetails ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {userDetails.uname
                .split(' ')
                .map((s) => s[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userDetails.uname}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userDetails.uid}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>Holdings</DropdownMenuItem>
          <DropdownMenuItem disabled>Positions</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/amo" target="_blank">
              Place AMO
              <ArrowTopRightIcon className="ml-2 mb-[1px] h-4 w-4" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar className="h-9 w-9">
        <AvatarFallback></AvatarFallback>
      </Avatar>
    </Button>
  );
}
