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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useActor } from "@/hooks/useActor";
import { useAdminList } from "@/hooks/useAdminList";
import {
  useConceptMachineVisibility,
  useSetConceptMachineVisibility,
} from "@/hooks/useConceptMachineVisibility";
import { useIsCallerAdmin } from "@/hooks/useIsCallerAdmin";
import { useIsCallerAdminPlus } from "@/hooks/useIsCallerAdminPlus";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import {
  useCurrentUserProfile,
  useGrantAdmin,
  useSaveUserProfile,
} from "@/hooks/useQueries";
import { Principal } from "@icp-sdk/core/principal";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Info,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const HARDCODED_ADMIN_PRINCIPAL =
  "nq44w-zh7mz-vkidk-kanua-rfijv-g2ail-o6b4k-ts6iu-qwwlh-e4le5-vqe";

export function ProfilePage() {
  const { userProfile, isLoading } = useCurrentUserProfile();
  const { isAdmin, isConfirmed: adminConfirmed } = useIsCallerAdmin();
  const { isAdminPlus } = useIsCallerAdminPlus();
  const { mutate: saveProfile, isPending: isSaving } = useSaveUserProfile();
  const { mutate: grantAdmin, isPending: isGranting } = useGrantAdmin();
  const { canInstall, install, isInstalled, isInstalling } = usePWAInstall();
  const { actor } = useActor();
  const queryClient = useQueryClient();

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

  // Remove admin confirmation dialog state
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<{
    principal: string;
    name: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Promote to admin+ confirmation state
  const [promoteConfirmOpen, setPromoteConfirmOpen] = useState(false);
  const [adminToPromote, setAdminToPromote] = useState<{
    principal: string;
    name: string;
  } | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

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

  const openRemoveConfirm = (principal: string, name: string) => {
    setAdminToRemove({ principal, name });
    setRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!adminToRemove || !actor) return;
    setIsRemoving(true);
    try {
      const principal = Principal.fromText(adminToRemove.principal);
      const result = await (actor as any).revokeAdminRole(principal);
      if (!result) throw new Error("Backend returned false");
      toast.success(
        `Admin rights removed for ${adminToRemove.name || adminToRemove.principal}`,
      );
      queryClient.invalidateQueries({ queryKey: ["adminList"] });
      queryClient.refetchQueries({ queryKey: ["adminList"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to remove admin rights");
    } finally {
      setIsRemoving(false);
      setRemoveConfirmOpen(false);
      setAdminToRemove(null);
    }
  };

  const openPromoteConfirm = (principal: string, name: string) => {
    setAdminToPromote({ principal, name });
    setPromoteConfirmOpen(true);
  };

  const handleConfirmPromote = async () => {
    if (!adminToPromote || !actor) return;
    setIsPromoting(true);
    try {
      const principal = Principal.fromText(adminToPromote.principal);
      const result = await (actor as any).grantAdminPlusRole(principal);
      if (!result) throw new Error("Backend returned false");
      toast.success(
        `Admin+ role granted to ${adminToPromote.name || adminToPromote.principal}`,
      );
      queryClient.invalidateQueries({ queryKey: ["adminList"] });
      queryClient.refetchQueries({ queryKey: ["adminList"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to promote to Admin+");
    } finally {
      setIsPromoting(false);
      setPromoteConfirmOpen(false);
      setAdminToPromote(null);
    }
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
        {/* Install App Card */}
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
              <div className="flex items-center gap-2">
                {isAdminPlus && (
                  <Badge
                    variant="default"
                    className="gap-1"
                    style={{ backgroundColor: "#808A54", color: "white" }}
                    data-ocid="profile.adminplus.badge"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Admin+
                  </Badge>
                )}
                {isAdmin && (
                  <Badge variant="default" className="gap-1">
                    <Shield className="w-3 h-3" />
                    Admin
                  </Badge>
                )}
              </div>
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
                    <div className="space-y-2" data-ocid="profile.admin.list">
                      {sortedAdminList.map((admin: any, idx) => {
                        const principalStr = admin.principal.toString();
                        const isHardcoded =
                          principalStr === HARDCODED_ADMIN_PRINCIPAL;
                        const isCurrentUser =
                          principalStr === userProfile?.principal.toString();
                        return (
                          <div
                            key={principalStr}
                            className="flex items-center justify-between p-3 border rounded-md bg-muted/30 gap-2"
                            data-ocid={`profile.admin.item.${idx + 1}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {admin.name ||
                                    `${principalStr.slice(0, 12)}...`}
                                </span>
                                {admin.isAdminPlus && (
                                  <Badge
                                    variant="default"
                                    className="gap-1 text-xs px-1.5 py-0"
                                    style={{
                                      backgroundColor: "#808A54",
                                      color: "white",
                                    }}
                                  >
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    Admin+
                                  </Badge>
                                )}
                                {isCurrentUser && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {principalStr}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Promote to Admin+ — only for admin+ users, only for non-admin+ admins, not hardcoded */}
                              {isAdminPlus &&
                                !admin.isAdminPlus &&
                                !isHardcoded && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-2 gap-1"
                                    style={{
                                      borderColor: "#808A54",
                                      color: "#808A54",
                                    }}
                                    onClick={() =>
                                      openPromoteConfirm(
                                        principalStr,
                                        admin.name,
                                      )
                                    }
                                    data-ocid={`profile.admin.promote_button.${idx + 1}`}
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    Make Admin+
                                  </Button>
                                )}

                              {/* Remove admin — only for admin+ users, not hardcoded, not yourself */}
                              {isAdminPlus &&
                                !isHardcoded &&
                                !isCurrentUser && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() =>
                                      openRemoveConfirm(
                                        principalStr,
                                        admin.name,
                                      )
                                    }
                                    data-ocid={`profile.admin.delete_button.${idx + 1}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                              {/* Copy principal */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  handleCopyAdminPrincipal(principalStr)
                                }
                              >
                                {copiedAdminPrincipal === principalStr ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
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

      {/* Remove Admin Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent data-ocid="profile.remove_admin.dialog">
          <DialogHeader>
            <DialogTitle>Remove Admin Rights</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove admin rights from{" "}
              <span className="font-semibold">
                {adminToRemove?.name || adminToRemove?.principal}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveConfirmOpen(false)}
              disabled={isRemoving}
              data-ocid="profile.remove_admin.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              data-ocid="profile.remove_admin.confirm_button"
            >
              {isRemoving ? "Removing..." : "Remove Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Admin+ Confirmation Dialog */}
      <Dialog open={promoteConfirmOpen} onOpenChange={setPromoteConfirmOpen}>
        <DialogContent data-ocid="profile.promote_admin.dialog">
          <DialogHeader>
            <DialogTitle>Promote to Admin+</DialogTitle>
            <DialogDescription>
              Grant Admin+ privileges to{" "}
              <span className="font-semibold">
                {adminToPromote?.name || adminToPromote?.principal}
              </span>
              ? Admin+ users can remove admins and promote others to Admin+.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteConfirmOpen(false)}
              disabled={isPromoting}
              data-ocid="profile.promote_admin.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPromote}
              disabled={isPromoting}
              style={{ backgroundColor: "#808A54" }}
              className="text-white hover:opacity-90"
              data-ocid="profile.promote_admin.confirm_button"
            >
              {isPromoting ? "Promoting..." : "Make Admin+"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
