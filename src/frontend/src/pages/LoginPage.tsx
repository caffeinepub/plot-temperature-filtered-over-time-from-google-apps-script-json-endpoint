import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { login, isLoggingIn, isLoginError, isInitializing, loginError } = useInternetIdentity();

  const handleLogin = () => {
    login();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Welcome</CardTitle>
          <CardDescription className="text-base">
            Sign in to access the log systems
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 pt-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="w-10 h-10 text-primary" />
          </div>
          
          {isLoginError && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loginError?.message || 'Login failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            onClick={handleLogin}
            disabled={isLoggingIn || isInitializing}
            size="lg"
            className="w-full"
          >
            {isLoggingIn || isInitializing ? 'Signing in...' : 'Sign in'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
