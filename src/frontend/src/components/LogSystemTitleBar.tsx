import type { UserProfileInfo } from "@/backend";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { ProfileMenu } from "./ProfileMenu";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  // Split subtitle for Conceptmachine to hide retention phrase on mobile
  const isConceptmachine = pageId === "conceptmachine";
  const retentionPhrase = "Data older than 19 days is not retained";

  let subtitleBeforeRetention = subtitle;
  let hasRetentionPhrase = false;

  if (isConceptmachine && subtitle.includes(retentionPhrase)) {
    hasRetentionPhrase = true;
    subtitleBeforeRetention = subtitle.replace(retentionPhrase, "").trim();
    // Remove trailing bullet if present
    if (subtitleBeforeRetention.endsWith("•")) {
      subtitleBeforeRetention = subtitleBeforeRetention.slice(0, -1).trim();
    }
  }

  // Show download button if user is admin and downloadUrl is provided (for both Conceptmachine and TSIC Loggers)
  const showDownloadButton = userProfile?.isAdmin && downloadUrl;

  const principal = identity?.getPrincipal().toString() || "";
  const truncatedPrincipal =
    principal.length > 20
      ? `${principal.slice(0, 10)}...${principal.slice(-8)}`
      : principal;

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleMobileAction = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await clear();
    queryClient.clear();
    setMobileMenuOpen(false);
  };

  const handleCopyPrincipal = async () => {
    await navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Desktop layout - hidden on mobile */}
      <div className="hidden md:grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
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
        <div className="flex justify-center items-center min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-center px-4">
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

          {/* Admin-only download button (for Conceptmachine and TSIC Loggers) */}
          {showDownloadButton && (
            <Button
              onClick={handleDownload}
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
            aria-label={
              isDarkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Refresh button */}
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="ghost"
            size="icon"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`}
            />
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

      {/* Mobile layout - visible only on mobile */}
      <div className="md:hidden flex items-center justify-between w-full">
        {/* Left: Title */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-center flex-1 pr-4">
          {title}
        </h1>

        {/* Right: Hamburger menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 sm:w-96">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl font-semibold text-primary">
                Menu
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-3">
              {/* User info section */}
              {userProfile && (
                <div className="bg-muted/50 rounded-lg p-4 mb-2">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {userProfile.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {truncatedPrincipal}
                  </p>
                </div>
              )}

              {/* Navigation section */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Navigation
                </p>
                <Button
                  onClick={() => handleMobileAction(onPrevious)}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 mr-3" />
                  Previous Page
                </Button>

                <Button
                  onClick={() => handleMobileAction(onNext)}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                >
                  <ChevronRight className="h-5 w-5 mr-3" />
                  Next Page
                </Button>
              </div>

              <Separator className="my-2" />

              {/* Actions section */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                  Actions
                </p>

                <Button
                  onClick={() => handleMobileAction(onNavigateToProfile)}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                >
                  Profile
                </Button>

                <Button
                  onClick={handleCopyPrincipal}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-5 w-5 mr-3 text-primary" />
                      <span className="text-primary font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5 mr-3" />
                      Copy Principal
                    </>
                  )}
                </Button>

                {/* Admin-only download button */}
                {showDownloadButton && (
                  <Button
                    onClick={() => handleMobileAction(handleDownload)}
                    variant="outline"
                    className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                  >
                    <Download className="h-5 w-5 mr-3" />
                    Download Data
                  </Button>
                )}

                {/* Theme toggle */}
                <Button
                  onClick={() => handleMobileAction(onToggleTheme)}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="h-5 w-5 mr-3" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5 mr-3" />
                      Dark Mode
                    </>
                  )}
                </Button>

                {/* Refresh button */}
                <Button
                  onClick={() => handleMobileAction(onRefresh)}
                  disabled={isRefreshing}
                  variant="outline"
                  className="w-full justify-start h-11 text-base hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-5 w-5 mr-3 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  Refresh Data
                </Button>
              </div>

              <Separator className="my-2" />

              {/* Logout section */}
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full justify-start h-11 text-base hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
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
