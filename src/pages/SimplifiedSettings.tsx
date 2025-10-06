import { useState } from "react";
import { useTranslation } from "react-i18next";

import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, User, Building, Crown, ExternalLink, LogOut, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceUsersManager } from "@/components/workspace/WorkspaceUsersManager";
import { RoleGuard } from "@/components/ui/RoleGuard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Settings = () => {
  const { t } = useTranslation('pages', { keyPrefix: 'settings' });
  const { user, signOut } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { planType } = usePermissions();

  const { toast } = useToast();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('toasts.signOutSuccess.title'),
        description: t('toasts.signOutSuccess.description')
      });
    } catch (error) {
      toast({
        title: t('toasts.signOutError.title'),
        description: t('toasts.signOutError.description'),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center homepage-text">
              <SettingsIcon className="w-8 h-8 mr-3 text-primary" />
              {t('pageTitle')}
            </h1>
          <p className="text-muted-foreground">
              {t('pageSubtitle')}
          </p>
        </div>

          <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                {t('account.title')}
            </CardTitle>
            <CardDescription>
                {t('account.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {userLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
              <div>
                      <Label>{t('account.email')}</Label>
                      <Skeleton className="h-4 w-full mt-1" />
              </div>
              <div>
                      <Label>{t('account.fullName')}</Label>
                      <Skeleton className="h-4 w-full mt-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">{t('account.email')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user?.email || t('account.missing')}
                </p>
              </div>
              <div>
                    <Label className="text-sm font-medium">{t('account.fullName')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile?.first_name && userProfile?.last_name
                        ? `${userProfile.first_name} ${userProfile.last_name}`
                        : t('account.missing')}
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {userLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('account.role')}</Label>
                    <Skeleton className="h-4 w-full mt-1" />
              </div>
              <div>
                    <Label>{t('account.workspacePlan')}</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">{t('account.role')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile?.role || t('account.roleMissing')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('account.workspacePlan')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {planType || currentWorkspace?.plan_type || 'Freemium'}
                    </p>
              </div>
            </div>
              )}
          </CardContent>
        </Card>

          <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2" />
                {t('workspace.title')}
            </CardTitle>
            <CardDescription>
                {t('workspace.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {workspaceLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('workspace.name')}</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                  <div>
                    <Label>{t('workspace.plan')}</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
              <div>
                    <Label className="text-sm font-medium">{t('workspace.name')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentWorkspace?.name || t('workspace.none')}
                    </p>
              </div>
              <div>
                    <Label className="text-sm font-medium">{t('workspace.plan')}</Label>
                    <p className="text-sm text-muted-foreground mt-1 capitalize">
                      {currentWorkspace?.plan_type || t('workspace.freemium')}
                    </p>
              </div>
            </div>
              )}
          </CardContent>
        </Card>

          <RoleGuard requirePermission="canManageUsers">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ExternalLink className="mr-2 h-5 w-5" />
                  {t('team.title')}
                </CardTitle>
                <CardDescription>
                  {t('team.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkspaceUsersManager />
              </CardContent>
            </Card>
          </RoleGuard>


          <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
                <SettingsIcon className="w-5 h-5 mr-2" />
                {t('actions.title')}
            </CardTitle>
              <CardDescription>{t('actions.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex items-center justify-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('actions.logout.button')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('actions.logout.confirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('actions.logout.confirmDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('actions.logout.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSignOut}>
                      {t('actions.logout.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </CardContent>
        </Card>

          <RoleGuard allowedRoles={["supra_admin"]}>
            <Card className="mb-6 border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center text-primary">
                  <Shield className="mr-2 h-5 w-5" />
                  {t('admin.title')}
                </CardTitle>
                <CardDescription>{t('admin.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="flex items-center justify-center"
                  onClick={() => window.open('/admin', '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('admin.openPanel')}
                </Button>
              </CardContent>
            </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Crown className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                    <h4 className="text-sm font-medium text-orange-800">{t('adminNotice.title')}</h4>
                  <p className="text-sm text-orange-700 mt-1">
                      {t('adminNotice.description')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          </RoleGuard>
        </div>
      </div>
    </div>
  );
};

export default Settings;