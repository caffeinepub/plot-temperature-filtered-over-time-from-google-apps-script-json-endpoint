import { useQueryClient } from '@tanstack/react-query';
import { LogSystemTitleBar } from './components/LogSystemTitleBar';
import { useLogSystemNavigation } from './hooks/useLogSystemNavigation';
import { useGlobalLastUpdated } from './hooks/useGlobalLastUpdated';
import { useThemeSession } from './hooks/useThemeSession';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useCurrentUserProfile } from './hooks/useCurrentUserProfile';
import { useIsCallerAdmin } from './hooks/useIsCallerAdmin';
import { useConceptMachineVisibility } from './hooks/useConceptMachineVisibility';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { logSystemPages } from './logSystems/logSystemPages';

// Hardcoded Google Sheets URLs
const CONCEPTMACHINE_GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1qMoehnVFWOydYBkOVcIkRfVH0RWZZKXTAVjk9gvnfx0/edit?usp=sharing';
const TSIC_LOGGERS_GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/11mSpPpRIZikPpacvWtXk-YIQD7ktIg4PHHtN_hIbKE8/edit?usp=sharing';

function App() {
  const { currentPage, goToPrevious, goToNext, goToPageId } = useLogSystemNavigation();
  const lastUpdated = useGlobalLastUpdated();
  const { isDarkMode, toggleTheme } = useThemeSession();
  const queryClient = useQueryClient();
  const { identity, isInitializing } = useInternetIdentity();
  const { userProfile, isLoading: profileLoading, isFetched: profileFetched } = useCurrentUserProfile();
  const { isAdmin, isLoading: adminLoading, isConfirmed: adminConfirmed } = useIsCallerAdmin();
  const { isVisible: conceptMachineVisible } = useConceptMachineVisibility();
  
  // Filter pages based on ConceptMachine visibility
  const visiblePages = logSystemPages.filter(page => {
    if (page.id === 'conceptmachine') {
      return conceptMachineVisible;
    }
    return true;
  });
  
  // Get current page from visible pages, fallback to profile if current page is hidden
  const currentVisiblePage = visiblePages.find(p => p.id === currentPage.id) || visiblePages.find(p => p.id === 'profile') || visiblePages[0];
  
  const PageComponent = currentVisiblePage.component;
  const isAuthenticated = !!identity;

  // Check if temperature-series query is currently fetching
  const isRefreshing = queryClient.isFetching({ queryKey: ['temperature-series'] }) > 0;

  // Check if current page requires admin access (all pages except Profile)
  const isProtectedPage = currentVisiblePage.id !== 'profile';

  // Determine download URL based on current page
  const getDownloadUrl = () => {
    if (!isAdmin) return undefined;
    
    if (currentVisiblePage.id === 'conceptmachine') {
      return CONCEPTMACHINE_GOOGLE_SHEETS_URL;
    } else if (currentVisiblePage.id === 'tsic-loggers') {
      return TSIC_LOGGERS_GOOGLE_SHEETS_URL;
    }
    
    return undefined;
  };

  const handleRefresh = () => {
    queryClient.refetchQueries({ queryKey: ['temperature-series'] });
  };

  const handleNavigateToProfile = () => {
    goToPageId('profile');
  };

  // Show login page while initializing or when not authenticated
  if (isInitializing || !isAuthenticated) {
    return <LoginPage />;
  }

  // Show profile setup modal if authenticated but no profile yet
  const showProfileSetup = isAuthenticated && !profileLoading && profileFetched && userProfile === null;

  // Default-deny: Show access denied for protected pages until admin status is confirmed
  // Only allow access if admin status is explicitly confirmed as true
  if (isProtectedPage) {
    const isCheckingAccess = adminLoading || !adminConfirmed;
    const isDenied = adminConfirmed && !isAdmin;

    if (isCheckingAccess || isDenied) {
      return (
        <div className="min-h-screen bg-background">
          <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
            <div className="container mx-auto px-6 py-6">
              <LogSystemTitleBar
                title={currentVisiblePage.displayName}
                subtitle={currentVisiblePage.subtitle}
                lastUpdated={lastUpdated}
                onPrevious={goToPrevious}
                onNext={goToNext}
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
            onGoToProfile={() => goToPageId('profile')} 
            isCheckingAccess={isCheckingAccess}
          />
          <footer className="border-t border-border bg-card mt-16">
            <div className="container mx-auto px-6 py-6">
              <div className="text-center text-sm text-muted-foreground">
                V2.0
              </div>
            </div>
          </footer>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
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
          <div className="text-center text-sm text-muted-foreground">
            V2.0
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
