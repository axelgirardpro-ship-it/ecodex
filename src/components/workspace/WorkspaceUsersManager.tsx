import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserPlus, Mail, Crown, Eye, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";

interface WorkspaceUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  user_roles: Array<{
    role: string;
    created_at: string;
  }>;
}

export const WorkspaceUsersManager: React.FC = () => {
  const { t, i18n } = useTranslation('pages', { keyPrefix: 'settings.team' });
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "gestionnaire">("gestionnaire");
  const [isInviting, setIsInviting] = useState(false);

  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const getWorkspaceUsers = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      setLoading(true);

      const { data: rawUsers, error } = await supabase
        .rpc('get_workspace_users_with_roles', {
          target_workspace_id: currentWorkspace.id
        });

      if (error) throw error;

      const normalizedUsers: WorkspaceUser[] = (rawUsers || []).map((rawUser) => {
        const unsafeUser = rawUser as Record<string, unknown>;

        let rolesUnknown = unsafeUser?.user_roles;
        if (typeof rolesUnknown === 'string') {
          try {
            rolesUnknown = JSON.parse(rolesUnknown);
          } catch {
            rolesUnknown = [];
          }
        }

        const normalizedRoles = Array.isArray(rolesUnknown)
          ? rolesUnknown
              .map((roleEntry) => {
                const entry = roleEntry as Record<string, unknown>;
                return {
                  role: String(entry?.role ?? entry?.role_name ?? ''),
                  created_at: String(entry?.created_at ?? ''),
                };
              })
              .filter((role) => role.role.length > 0)
          : [];

        return {
          user_id: String(unsafeUser?.user_id ?? ''),
          first_name: String(unsafeUser?.first_name ?? ''),
          last_name: String(unsafeUser?.last_name ?? ''),
          email: String(unsafeUser?.email ?? ''),
          created_at: String(unsafeUser?.created_at ?? ''),
          user_roles: normalizedRoles,
        };
      });

      setUsers(normalizedUsers);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
      toast({
        variant: "destructive",
        title: t('toasts.loadError.title'),
        description: t('toasts.loadError.description'),
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, t, toast]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      void getWorkspaceUsers();
    }
  }, [currentWorkspace?.id, getWorkspaceUsers]);

  const handleInviteUser = async () => {
    if (!currentWorkspace?.id || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);

      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          workspaceId: currentWorkspace.id,
          role: inviteRole,
          redirectTo: `${window.location.origin}/auth/callback?type=invite&workspaceId=${currentWorkspace.id}&role=${inviteRole}`
        }
      });

      if (error) {
        throw new Error(error.message || t('toasts.inviteError.description'));
      }

      const typedResult = result as { success?: boolean; error?: string; code?: string } | null;
      if (!typedResult?.success) {
        if (typedResult?.code === 'existing-user-linked') {
          toast({
            title: t('toasts.inviteExisting.title'),
            description: t('toasts.inviteExisting.description', { email: inviteEmail })
          });
          setInviteEmail('');
          setIsInviteDialogOpen(false);
          void getWorkspaceUsers();
          return;
        }

        throw new Error(typedResult?.error || t('toasts.inviteError.description'));
      }

      toast({
        title: t('toasts.inviteSuccess.title'),
        description: t('toasts.inviteSuccess.description', { email: inviteEmail }),
      });

      setInviteEmail('');
      setIsInviteDialogOpen(false);

      setTimeout(() => {
        void getWorkspaceUsers();
      }, 1000);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        variant: "destructive",
        title: t('toasts.inviteError.title'),
        description: error instanceof Error ? error.message : t('toasts.inviteError.description'),
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!currentWorkspace?.id) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      toast({
        title: t('toasts.updateRoleSuccess.title'),
        description: t('toasts.updateRoleSuccess.description'),
      });

      void getWorkspaceUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: t('toasts.updateRoleError.title'),
        description: t('toasts.updateRoleError.description'),
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentWorkspace?.id) return;

    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspace.id);

      if (roleError) throw roleError;

      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspace.id);

      if (userError) throw userError;

      toast({
        title: t('toasts.removeUserSuccess.title'),
        description: t('toasts.removeUserSuccess.description'),
      });

      void getWorkspaceUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        variant: "destructive",
        title: t('toasts.removeUserError.title'),
        description: t('toasts.removeUserError.description'),
      });
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? Crown : Eye;
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
            <Skeleton className="h-10 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
          </div>

          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t('invite.button')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('invite.dialogTitle')}</DialogTitle>
                <DialogDescription>
                  {t('invite.dialogDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('invite.emailPlaceholder')}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">{t('invite.roleLabel')}</Label>
                  <Select value={inviteRole} onValueChange={(value: "admin" | "gestionnaire") => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestionnaire">{t('roles.gestionnaire')}</SelectItem>
                      <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    {t('invite.cancel')}
                  </Button>
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail.trim() || isInviting}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isInviting ? t('invite.sending') : t('invite.submit')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {users.length === 0 ? (
          <Alert>
            <AlertDescription>
              {t('empty')}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    {t('table.user')}
                  </th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground w-36">
                    {t('table.role')}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-28">
                    {t('table.addedAt')}
                  </th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-b hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user.first_name?.[0] || user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {user.first_name && user.last_name ?
                              `${user.first_name} ${user.last_name}` :
                              t('table.fallbackName')
                            }
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-2 text-center">
                      <Badge
                        variant={getRoleBadgeVariant(user.user_roles[0]?.role)}
                        className="flex items-center gap-1 whitespace-nowrap text-xs px-3 py-1.5"
                      >
                        {React.createElement(getRoleIcon(user.user_roles[0]?.role), { className: "h-3 w-3" })}
                        {user.user_roles[0]?.role === 'admin' ? t('roles.admin') : t('roles.gestionnaire')}
                      </Badge>
                    </td>

                    <td className="py-4 px-4 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-GB')}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleUpdateUserRole(
                              user.user_id,
                              user.user_roles[0]?.role === 'admin' ? 'gestionnaire' : 'admin'
                            )}>
                              <Crown className="h-4 w-4 mr-2" />
                              {user.user_roles[0]?.role === 'admin' ? t('table.downgrade') : t('table.promote')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user.user_id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('table.remove')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
