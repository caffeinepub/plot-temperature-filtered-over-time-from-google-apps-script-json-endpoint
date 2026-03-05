import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";

interface AccessDeniedScreenProps {
  onGoToProfile: () => void;
  isCheckingAccess?: boolean;
}

export function AccessDeniedScreen({
  onGoToProfile,
  isCheckingAccess = false,
}: AccessDeniedScreenProps) {
  if (isCheckingAccess) {
    return (
      <main className="container mx-auto px-6 py-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Checking Access
              </CardTitle>
              <CardDescription className="text-base">
                Verifying your permissions...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-6 py-16">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
            <CardDescription className="text-base">
              You don't have permission to view this page. Only administrators
              can access the log systems.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4 pt-4">
            <Button onClick={onGoToProfile} size="lg" className="w-full">
              Go to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
