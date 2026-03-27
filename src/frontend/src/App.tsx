import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { AccessDeniedScreen } from "./components/AccessDeniedScreen";
import { LogSystemTitleBar } from "./components/LogSystemTitleBar";
import { PWAAssets } from "./components/PWAAssets";
import { ProfileSetupModal } from "./components/ProfileSetupModal";
import { useConceptMachineVisibility } from "./hooks/useConceptMachineVisibility";
import { useCurrentUserProfile } from "./hooks/useCurrentUserProfile";
import { useGlobalLastUpdated } from "./hooks/useGlobalLastUpdated";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useIsCallerAdmin } from "./hooks/useIsCallerAdmin";
import { useLogSystemNavigation } from "./hooks/useLogSystemNavigation";
import { useThemeSession } from "./hooks/useThemeSession";
import { logSystemPages } from "./logSystems/logSystemPages";
import { LoginPage } from "./pages/LoginPage";

// Hardcoded Google Sheets URLs
const CONCEPTMACHINE_GOOGLE_SHEETS_URL =
  "https://docs.google.com/spreadsheets/d/1qMoehnVFWOydYBkOVcIkRfVH0RWZZKXTAVjk9gvnfx0/edit?usp=sharing";
const TSIC_LOGGERS_GOOGLE_SHEETS_URL =
  "https://docs.google.com/spreadsheets/d/11mSpPpRIZikPpacvWtXk-YIQD7ktIg4PHHtN_hIbKE8/edit?usp=sharing";

function App() {
  const { currentPage, goToPrevious, goToNext, goToPageId } =
    useLogSystemNavigation();
  const lastUpdated = useGlobalLastUpdated();
  const { isDarkMode, toggleTheme } = useThemeSession();
  const queryClient = useQueryClient();
  const { identity, isInitializing } = useInternetIdentity();
  const {
    userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useCurrentUserProfile();
  const {
    isAdmin,
    isLoading: adminLoading,
    isConfirmed: adminConfirmed,
  } = useIsCallerAdmin();
  const { isVisible: conceptMachineVisible } = useConceptMachineVisibility();

  const [footerAboutOpen, setFooterAboutOpen] = useState(false);

  // Filter pages based on ConceptMachine visibility
  const visiblePages = logSystemPages.filter((page) => {
    if (page.id === "conceptmachine") {
      return conceptMachineVisible;
    }
    return true;
  });

  // Get current page from visible pages, fallback to profile if current page is hidden
  const currentVisiblePage =
    visiblePages.find((p) => p.id === currentPage.id) ||
    visiblePages.find((p) => p.id === "profile") ||
    visiblePages[0];

  const PageComponent = currentVisiblePage.component;
  const isAuthenticated = !!identity;

  // Check if any relevant query is currently fetching
  const isRefreshing =
    queryClient.isFetching({ queryKey: ["temperature-series"] }) > 0 ||
    queryClient.isFetching({ queryKey: ["tsic-data"] }) > 0;

  // Check if current page requires admin access (all pages except Profile)
  const isProtectedPage = currentVisiblePage.id !== "profile";

  // Determine download URL based on current page
  const getDownloadUrl = () => {
    if (!isAdmin) return undefined;

    if (currentVisiblePage.id === "conceptmachine") {
      return CONCEPTMACHINE_GOOGLE_SHEETS_URL;
    }
    if (currentVisiblePage.id === "tsic-loggers") {
      return TSIC_LOGGERS_GOOGLE_SHEETS_URL;
    }

    return undefined;
  };

  const handleRefresh = () => {
    // Refresh Conceptmachine data
    queryClient.refetchQueries({ queryKey: ["temperature-series"] });
    // Refresh all active TSIC logger data
    queryClient.refetchQueries({ queryKey: ["tsic-data"] });
  };

  const handleNavigateToProfile = () => {
    goToPageId("profile");
  };

  // Compute prev/next page names for nav buttons (wraps around, uses visiblePages)
  const visiblePageCount = visiblePages.length;
  const currentVisibleIndex = visiblePages.findIndex(
    (p) => p.id === currentVisiblePage.id,
  );
  const previousPageName =
    visiblePageCount > 1
      ? visiblePages[
          (currentVisibleIndex - 1 + visiblePageCount) % visiblePageCount
        ].displayName
      : undefined;
  const nextPageName =
    visiblePageCount > 1
      ? visiblePages[(currentVisibleIndex + 1) % visiblePageCount].displayName
      : undefined;

  // Show login page while initializing or when not authenticated
  if (isInitializing || !isAuthenticated) {
    return (
      <>
        <PWAAssets />
        <LoginPage />
      </>
    );
  }

  // Show profile setup modal if authenticated but no profile yet
  const showProfileSetup =
    isAuthenticated &&
    !profileLoading &&
    profileFetched &&
    userProfile === null;

  // Default-deny: Show access denied for protected pages until admin status is confirmed
  // Only allow access if admin status is explicitly confirmed as true
  if (isProtectedPage) {
    const isCheckingAccess = adminLoading || !adminConfirmed;
    const isDenied = adminConfirmed && !isAdmin;

    if (isCheckingAccess || isDenied) {
      return (
        <div className="min-h-screen bg-background">
          <PWAAssets />
          <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
            <div className="container mx-auto px-6 py-6">
              <LogSystemTitleBar
                title={currentVisiblePage.displayName}
                subtitle={currentVisiblePage.subtitle}
                lastUpdated={lastUpdated}
                onPrevious={goToPrevious}
                onNext={goToNext}
                previousPageName={previousPageName}
                nextPageName={nextPageName}
                pageId={currentVisiblePage.id}
                downloadUrl={undefined}
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                userProfile={userProfile}
                onNavigateToProfile={handleNavigateToProfile}
              />
            </div>
          </header>
          <AccessDeniedScreen
            onGoToProfile={() => goToPageId("profile")}
            isCheckingAccess={isCheckingAccess}
          />
          <footer className="border-t border-border bg-card mt-16">
            <div className="container mx-auto px-6 py-6">
              <div className="text-center text-sm text-muted-foreground">
                <span>V2.1 · March 2026</span>
              </div>
            </div>
          </footer>
        </div>
      );
    }
  }

  const isAdminConfirmed = isAdmin && adminConfirmed;

  return (
    <div className="min-h-screen bg-background">
      <PWAAssets />
      {showProfileSetup && <ProfileSetupModal />}

      {/* Header with Navigation */}
      <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <LogSystemTitleBar
            title={currentVisiblePage.displayName}
            subtitle={currentVisiblePage.subtitle}
            lastUpdated={lastUpdated}
            onPrevious={goToPrevious}
            onNext={goToNext}
            previousPageName={previousPageName}
            nextPageName={nextPageName}
            pageId={currentVisiblePage.id}
            downloadUrl={getDownloadUrl()}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            userProfile={userProfile}
            onNavigateToProfile={handleNavigateToProfile}
          />
        </div>
      </header>

      {/* Page Content */}
      <PageComponent />

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            {isAdminConfirmed ? (
              <>
                <button
                  type="button"
                  onClick={() => setFooterAboutOpen(true)}
                  className="hover:text-primary transition-colors cursor-pointer underline-offset-2 hover:underline"
                  data-ocid="footer.about.button"
                >
                  V2.1 · March 2026
                </button>
                <button
                  type="button"
                  onClick={() => setFooterAboutOpen(true)}
                  className="hover:text-primary transition-colors cursor-pointer rounded p-0.5"
                  aria-label="About this project"
                  data-ocid="footer.open_modal_button"
                >
                  <Info size={14} />
                </button>
              </>
            ) : (
              <span>V2.1 · March 2026</span>
            )}
          </div>
        </div>
      </footer>

      {isAdminConfirmed && (
        <AboutDialog open={footerAboutOpen} onOpenChange={setFooterAboutOpen} />
      )}
    </div>
  );
}

export default App;
