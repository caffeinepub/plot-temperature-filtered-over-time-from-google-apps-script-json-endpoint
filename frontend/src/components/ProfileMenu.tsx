import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Copy, Check, LogOut, UserCircle } from 'lucide-react';
import { useState } from 'react';
import type { UserProfileInfo } from '@/backend';

interface ProfileMenuProps {
  userProfile: UserProfileInfo | null | undefined;
  onNavigateToProfile: () => void;
}

export function ProfileMenu({ userProfile, onNavigateToProfile }: ProfileMenuProps) {
  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const principal = identity?.getPrincipal().toString() || '';
  const truncatedPrincipal = principal.length > 20 
    ? `${principal.slice(0, 10)}...${principal.slice(-8)}`
    : principal;

  const handleSignOut = async () => {
    await clear();
    // Clear all cached data including user profile and admin list
    queryClient.clear();
  };

  const handleCopyPrincipal = async () => {
    await navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Profile menu"
        >
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userProfile?.name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground font-mono">
              {truncatedPrincipal}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyPrincipal}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          <span>{copied ? 'Copied!' : 'Copy principal'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNavigateToProfile}>
          <UserCircle className="mr-2 h-4 w-4" />
          <span>Account</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
