import { AboutDialog } from "@/components/AboutDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAdminList } from "@/hooks/useAdminList";
import {
  useConceptMachineVisibility,
  useSetConceptMachineVisibility,
} from "@/hooks/useConceptMachineVisibility";
import { useIsCallerAdmin } from "@/hooks/useIsCallerAdmin";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import {
  useCurrentUserProfile,
  useGrantAdmin,
  useSaveUserProfile,
} from "@/hooks/useQueries";
import { Principal } from "@icp-sdk/core/principal";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Info,
  RefreshCw,
  Shield,
  Smartphone,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ProfilePage() {
  const { userProfile, isLoading } = useCurrentUserProfile();
  const { isAdmin, isConfirmed: adminConfirmed } = useIsCallerAdmin();
  const { mutate: saveProfile, isPending: isSaving } = useSaveUserProfile();
  const { mutate: grantAdmin, isPending: isGranting } = useGrantAdmin();
  const { canInstall, install, isInstalled, isInstalling } = usePWAInstall();

  const {
    data: adminList,
    isLoading: adminListLoading,
    error: adminListError,
    refetch: refetchAdminList,
  } = useAdminList(adminConfirmed && isAdmin);

  const { isVisible: conceptMachineVisible, isLoading: visibilityLoading } =
    useConceptMachineVisibility();
  const { mutate: setConceptMachineVisible, isPending: isSettingVisibility } =
    useSetConceptMachineVisibility();

  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [adminPrincipal, setAdminPrincipal] = useState("");
  const [copiedPrincipal, setCopiedPrincipal] = useState(false);
  const [copiedAdminPrincipal, setCopiedAdminPrincipal] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleSaveName = () => {
    if (name.trim()) {
      saveProfile(
        { name: name.trim() },
        {
          onSuccess: () => {
            setIsEditingName(false);
            setName("");
            toast.success("Name updated successfully");
          },
          onError: (error) => {
            toast.error(`Failed to update name: ${error.message}`);
          },
        },
      );
    }
  };

  const handleGrantAdmin = () => {
    const principalText = adminPrincipal.trim();
    if (!principalText) {
      toast.error("Please enter a principal ID");
      return;
    }

    try {
      Principal.fromText(principalText);
    } catch (_error) {
      toast.error("Invalid principal ID format. Please check and try again.");
      return;
    }

    grantAdmin(principalText, {
      onSuccess: () => {
        setAdminPrincipal("");
        toast.success("Admin rights granted successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to grant admin rights");
      },
    });
  };

  const handleCopyPrincipal = async () => {
    if (userProfile?.principal) {
      await navigator.clipboard.writeText(userProfile.principal.toString());
      setCopiedPrincipal(true);
      toast.success("Principal copied to clipboard");
      setTimeout(() => setCopiedPrincipal(false), 2000);
    }
  };

  const handleCopyAdminPrincipal = async (principal: string) => {
    await navigator.clipboard.writeText(principal);
    setCopiedAdminPrincipal(principal);
    toast.success("Principal copied to clipboard");
    setTimeout(() => setCopiedAdminPrincipal(null), 2000);
  };

  const handleRefreshAdminList = async () => {
    setIsRefreshing(true);
    try {
      await refetchAdminList();
      toast.success("Admin list refreshed");
    } catch (error: any) {
      toast.error(`Failed to refresh: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleConceptMachineVisibility = (checked: boolean) => {
    setConceptMachineVisible(checked, {
      onSuccess: () => {
        toast.success(
          checked
            ? "ConceptMachine page is now visible"
            : "ConceptMachine page is now hidden",
        );
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update visibility setting");
      },
    });
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                Loading profile...
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const sortedAdminList = adminList
    ? [...adminList].sort((a, b) =>
        a.principal.toString().localeCompare(b.principal.toString()),
      )
    : [];

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Install App Card — visible to all users when PWA install is available */}
        {canInstall && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Install App</p>
                    <p className="text-xs text-muted-foreground">
                      Add Conceptmachine to your home screen for quick access
                    </p>
                  </div>
                </div>
                <Button
                  onClick={install}
                  disabled={isInstalling}
                  size="sm"
                  className="gap-2 flex-shrink-0"
                  data-ocid="profile.install.button"
                >
                  <Download className="w-4 h-4" />
                  {isInstalling ? "Installing..." : "Install"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already installed indicator */}
        {isInstalled && (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-green-700 dark:text-green-300">
                    App Installed
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    Conceptmachine is installed on this device
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Manage your account information
                  </CardDescription>
                </div>
              </div>
              {isAdmin && (
                <Badge variant="default" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Display Name */}
            <div className="space-y-2">
              <Label>Display Name</Label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={userProfile?.name || "Enter your name"}
                    disabled={isSaving}
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={!name.trim() || isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingName(false);
                      setName("");
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="font-medium">
                    {userProfile?.name || "Not set"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setName(userProfile?.name || "");
                      setIsEditingName(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Principal ID */}
            <div className="space-y-2">
              <Label>Principal ID</Label>
              <div className="flex gap-2">
                <Input
                  value={userProfile?.principal.toString() || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPrincipal}
                >
                  {copiedPrincipal ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* About button — admins only */}
            {isAdmin && adminConfirmed && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setAboutOpen(true)}
                    data-ocid="profile.about.button"
                  >
                    <Info className="w-4 h-4" />
                    About
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Admin Controls - Only visible to confirmed admins */}
        {isAdmin && adminConfirmed && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Admin Controls</CardTitle>
                  <CardDescription>
                    Manage administrator access and page visibility
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ConceptMachine Page Visibility Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="conceptmachine-visibility">
                      Show ConceptMachine page
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable the ConceptMachine page for all users
                    </p>
                  </div>
                  <Switch
                    id="conceptmachine-visibility"
                    checked={conceptMachineVisible}
                    onCheckedChange={handleToggleConceptMachineVisibility}
                    disabled={visibilityLoading || isSettingVisibility}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="admin-principal">Grant Admin Rights</Label>
                <div className="flex gap-2">
                  <Input
                    id="admin-principal"
                    value={adminPrincipal}
                    onChange={(e) => setAdminPrincipal(e.target.value)}
                    placeholder="Enter principal ID"
                    className="font-mono text-sm"
                    disabled={isGranting}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && adminPrincipal.trim()) {
                        handleGrantAdmin();
                      }
                    }}
                  />
                  <Button
                    onClick={handleGrantAdmin}
                    disabled={!adminPrincipal.trim() || isGranting}
                  >
                    {isGranting ? "Granting..." : "Grant"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the principal ID of the user you want to make an
                  administrator.
                </p>
              </div>

              <Separator />

              {/* Admin List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Current Administrators</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshAdminList}
                    disabled={isRefreshing || adminListLoading}
                    className="gap-2"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
                {adminListLoading && (
                  <div className="text-sm text-muted-foreground">
                    Loading admin list...
                  </div>
                )}
                {adminListError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {adminListError.message || "Failed to load admin list"}
                    </AlertDescription>
                  </Alert>
                )}
                {!adminListLoading &&
                  !adminListError &&
                  sortedAdminList.length > 0 && (
                    <div className="space-y-2">
                      {sortedAdminList.map((admin) => (
                        <div
                          key={admin.principal.toString()}
                          className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {admin.name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {admin.principal.toString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleCopyAdminPrincipal(
                                admin.principal.toString(),
                              )
                            }
                            className="ml-2 flex-shrink-0"
                          >
                            {copiedAdminPrincipal ===
                            admin.principal.toString() ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                {!adminListLoading &&
                  !adminListError &&
                  sortedAdminList.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No administrators found
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </main>
  );
}
