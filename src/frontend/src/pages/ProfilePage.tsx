import { useState } from 'react';
import { useCurrentUserProfile, useSaveUserProfile, useGrantAdmin } from '@/hooks/useQueries';
import { useAdminList } from '@/hooks/useAdminList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Shield, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Principal } from '@icp-sdk/core/principal';

export function ProfilePage() {
  const { userProfile, isLoading } = useCurrentUserProfile();
  const { mutate: saveProfile, isPending: isSaving } = useSaveUserProfile();
  const { mutate: grantAdmin, isPending: isGranting } = useGrantAdmin();
  
  const isAdmin = userProfile?.isAdmin ?? false;
  const { data: adminList, isLoading: adminListLoading, error: adminListError, refetch: refetchAdminList } = useAdminList(isAdmin);
  
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [adminPrincipal, setAdminPrincipal] = useState('');
  const [copiedPrincipal, setCopiedPrincipal] = useState(false);
  const [copiedAdminPrincipal, setCopiedAdminPrincipal] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSaveName = () => {
    if (name.trim()) {
      saveProfile(
        { name: name.trim() },
        {
          onSuccess: () => {
            setIsEditingName(false);
            setName('');
            toast.success('Name updated successfully');
          },
          onError: (error) => {
            toast.error(`Failed to update name: ${error.message}`);
          },
        }
      );
    }
  };

  const handleGrantAdmin = () => {
    const principalText = adminPrincipal.trim();
    if (!principalText) {
      toast.error('Please enter a principal ID');
      return;
    }

    // Validate principal format client-side before calling backend
    try {
      Principal.fromText(principalText);
    } catch (error) {
      toast.error('Invalid principal ID format. Please check and try again.');
      return;
    }

    grantAdmin(
      principalText,
      {
        onSuccess: () => {
          setAdminPrincipal('');
          toast.success('Admin rights granted successfully');
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to grant admin rights');
        },
      }
    );
  };

  const handleCopyPrincipal = async () => {
    if (userProfile?.principal) {
      await navigator.clipboard.writeText(userProfile.principal.toString());
      setCopiedPrincipal(true);
      toast.success('Principal copied to clipboard');
      setTimeout(() => setCopiedPrincipal(false), 2000);
    }
  };

  const handleCopyAdminPrincipal = async (principal: string) => {
    await navigator.clipboard.writeText(principal);
    setCopiedAdminPrincipal(principal);
    toast.success('Principal copied to clipboard');
    setTimeout(() => setCopiedAdminPrincipal(null), 2000);
  };

  const handleRefreshAdminList = async () => {
    setIsRefreshing(true);
    try {
      await refetchAdminList();
      toast.success('Admin list refreshed');
    } catch (error: any) {
      toast.error(`Failed to refresh: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">Loading profile...</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Sort admin list by principal for stable ordering
  const sortedAdminList = adminList ? [...adminList].sort((a, b) => 
    a.principal.toString().localeCompare(b.principal.toString())
  ) : [];

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
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
                  <CardDescription>Manage your account information</CardDescription>
                </div>
              </div>
              {userProfile?.isAdmin && (
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
                    placeholder={userProfile?.name || 'Enter your name'}
                    disabled={isSaving}
                  />
                  <Button onClick={handleSaveName} disabled={!name.trim() || isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingName(false);
                      setName('');
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <span className="font-medium">{userProfile?.name || 'Not set'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setName(userProfile?.name || '');
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
                  value={userProfile?.principal.toString() || ''}
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
          </CardContent>
        </Card>

        {/* Admin Controls - Only visible to admins */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Admin Controls</CardTitle>
                  <CardDescription>Manage administrator access</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      if (e.key === 'Enter' && adminPrincipal.trim()) {
                        handleGrantAdmin();
                      }
                    }}
                  />
                  <Button
                    onClick={handleGrantAdmin}
                    disabled={!adminPrincipal.trim() || isGranting}
                  >
                    {isGranting ? 'Granting...' : 'Grant'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the principal ID of the user you want to make an administrator.
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
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                {adminListLoading ? (
                  <div className="text-sm text-muted-foreground">Loading admin list...</div>
                ) : adminListError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to load admin list: {adminListError.message}
                    </AlertDescription>
                  </Alert>
                ) : sortedAdminList.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No administrators found.</div>
                ) : (
                  <div className="space-y-2">
                    {sortedAdminList.map((admin) => (
                      <div
                        key={admin.principal.toString()}
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/30"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="font-medium text-sm">{admin.name}</div>
                          <div className="font-mono text-xs text-muted-foreground truncate">
                            {admin.principal.toString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 ml-2"
                          onClick={() => handleCopyAdminPrincipal(admin.principal.toString())}
                        >
                          {copiedAdminPrincipal === admin.principal.toString() ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
