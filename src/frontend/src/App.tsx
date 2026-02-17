import { useQueryClient } from '@tanstack/react-query';
import { LogSystemTitleBar } from './components/LogSystemTitleBar';
import { useLogSystemNavigation } from './hooks/useLogSystemNavigation';
import { useGlobalLastUpdated } from './hooks/useGlobalLastUpdated';
import { useThemeSession } from './hooks/useThemeSession';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useCurrentUserProfile } from './hooks/useCurrentUserProfile';
import { useGoogleSheetsDownloadLink } from './hooks/useGoogleSheetsDownloadLink';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { ProfileSetupModal } from './components/ProfileSetupModal';

function App() {
  const { currentPage, goToPrevious, goToNext, goToPageId } = useLogSystemNavigation();
  const lastUpdated = useGlobalLastUpdated();
  const { isDarkMode, toggleTheme } = useThemeSession();
  const queryClient = useQueryClient();
  const { identity, isInitializing } = useInternetIdentity();
  const { userProfile, isLoading: profileLoading, isFetched } = useCurrentUserProfile();
  
  const PageComponent = currentPage.component;
  const isAuthenticated = !!identity;

  // Check if temperature-series query is currently fetching
  const isRefreshing = queryClient.isFetching({ queryKey: ['temperature-series'] }) > 0;

  // Check if current page requires admin access (all pages except Profile)
  const isProtectedPage = currentPage.id !== 'profile';
  const isAdmin = userProfile?.isAdmin ?? false;

  // Fetch download link only for admins on Conceptmachine page
  const isConceptmachinePage = currentPage.id === 'conceptmachine';
  const shouldFetchDownloadLink = isAdmin && isConceptmachinePage && !profileLoading && isFetched;
  const { data: downloadUrl } = useGoogleSheetsDownloadLink(shouldFetchDownloadLink);

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
  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  // Show access denied if trying to access protected page without admin rights
  // Only check after profile has been fetched to avoid premature blocking
  if (isProtectedPage && !isAdmin && !profileLoading && isFetched) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
          <div className="container mx-auto px-6 py-6">
            <LogSystemTitleBar
              title={currentPage.displayName}
              subtitle={currentPage.subtitle}
              lastUpdated={lastUpdated}
              onPrevious={goToPrevious}
              onNext={goToNext}
              pageId={currentPage.id}
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
        <AccessDeniedScreen onGoToProfile={() => goToPageId('profile')} />
        <footer className="border-t border-border bg-card mt-16">
          <div className="container mx-auto px-6 py-6">
            <div className="text-center text-sm text-muted-foreground">
              V1.0
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showProfileSetup && <ProfileSetupModal />}
      
      {/* Header with Navigation */}
      <header className="border-b-4 border-t-4 border-primary bg-card shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <LogSystemTitleBar
            title={currentPage.displayName}
            subtitle={currentPage.subtitle}
            lastUpdated={lastUpdated}
            onPrevious={goToPrevious}
            onNext={goToNext}
            pageId={currentPage.id}
            downloadUrl={isAdmin && isConceptmachinePage ? downloadUrl : undefined}
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
            V1.0
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
