import { ChevronLeft, ChevronRight, Moon, Sun, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ProfileMenu } from './ProfileMenu';
import type { UserProfileInfo } from '@/backend';

interface LogSystemTitleBarProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  onPrevious: () => void;
  onNext: () => void;
  pageId: string;
  downloadUrl?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  userProfile: UserProfileInfo | null | undefined;
  onNavigateToProfile: () => void;
}

export function LogSystemTitleBar({ 
  title, 
  subtitle, 
  lastUpdated, 
  onPrevious, 
  onNext,
  pageId,
  downloadUrl,
  isDarkMode,
  onToggleTheme,
  onRefresh,
  isRefreshing,
  userProfile,
  onNavigateToProfile,
}: LogSystemTitleBarProps) {
  // Split subtitle for Conceptmachine to hide retention phrase on mobile
  const isConceptmachine = pageId === 'conceptmachine';
  const retentionPhrase = 'Data older than 19 days is not retained';
  
  let subtitleBeforeRetention = subtitle;
  let hasRetentionPhrase = false;
  
  if (isConceptmachine && subtitle.includes(retentionPhrase)) {
    hasRetentionPhrase = true;
    subtitleBeforeRetention = subtitle.replace(retentionPhrase, '').trim();
    // Remove trailing bullet if present
    if (subtitleBeforeRetention.endsWith('•')) {
      subtitleBeforeRetention = subtitleBeforeRetention.slice(0, -1).trim();
    }
  }

  // Only show download button if user is admin and downloadUrl is provided
  const showDownloadButton = userProfile?.isAdmin && isConceptmachine && downloadUrl;

  return (
    <div className="space-y-4">
      {/* Title row with navigation and controls - using grid for true centering */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
        {/* Left: Previous button */}
        <div className="flex justify-start">
          <Button
            onClick={onPrevious}
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Previous log system"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Center: Title (truly centered) */}
        <div className="flex justify-center min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-center truncate px-4">
            {title}
          </h1>
        </div>
        
        {/* Right: Control buttons */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          {/* Profile menu */}
          <ProfileMenu 
            userProfile={userProfile} 
            onNavigateToProfile={onNavigateToProfile}
          />
          
          {/* Conceptmachine-only download button (admin-only) */}
          {showDownloadButton && (
            <Button
              onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
              variant="ghost"
              size="icon"
              aria-label="Download data"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}
          
          {/* Theme toggle */}
          <Button
            onClick={onToggleTheme}
            variant="ghost"
            size="icon"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          {/* Refresh button */}
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="ghost"
            size="icon"
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            onClick={onNext}
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Next log system"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Subtitle row with green lines and last updated */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Separator className="flex-1 bg-primary h-0.5" />
          <p className="text-sm text-muted-foreground whitespace-nowrap px-2">
            {isConceptmachine && hasRetentionPhrase ? (
              <>
                {subtitleBeforeRetention}
                <span className="hidden sm:inline"> • {retentionPhrase}</span>
              </>
            ) : (
              subtitle
            )}
          </p>
          <Separator className="flex-1 bg-primary h-0.5" />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </div>
      </div>
    </div>
  );
}
