import React, { useState, useEffect } from "react";
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

export const WorkspaceUsersManager = () => {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "gestionnaire">("gestionnaire");
  const [isInviting, setIsInviting] = useState(false);
  
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  useEffect(() => {
    if (currentWorkspace?.id) {
      getWorkspaceUsers();
    }
  }, [currentWorkspace?.id]);

  const getWorkspaceUsers = async () => {
    if (!currentWorkspace?.id) return;

    try {
      setLoading(true);
      
      // Utiliser directement la RPC function existante
      const { data: users, error } = await supabase
        .rpc('get_workspace_users_with_roles', {
          target_workspace_id: currentWorkspace.id
        });

      if (error) throw error;
      
      setUsers(users || []);
    } catch (error: any) {
      console.error('Error fetching workspace users:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les utilisateurs du workspace",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!currentWorkspace?.id || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);

      // Utiliser l'Edge Function (auth et apikey gérées par le client supabase)
      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail.toLowerCase().trim(),
          workspaceId: currentWorkspace.id,
          role: inviteRole,
          redirectTo: `${window.location.origin}/auth/callback?type=invite&workspaceId=${currentWorkspace.id}&role=${inviteRole}`
        }
      });

      if (error || !(result as any)?.success) {
        throw new Error(error?.message || (result as any)?.error || 'Erreur lors de l\'invitation');
      }

      toast({
        title: "Invitation envoyée !",
        description: `Une invitation a été envoyée à ${inviteEmail}`,
      });

      setInviteEmail("");
      setIsInviteDialogOpen(false);
      
      // Recharger la liste des utilisateurs
      setTimeout(() => getWorkspaceUsers(), 1000);

    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation",
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
        title: "Rôle mis à jour",
        description: `Le rôle de l'utilisateur a été modifié`,
      });

      getWorkspaceUsers();
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le rôle",
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentWorkspace?.id) return;

    try {
      // Supprimer de user_roles d'abord
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspace.id);

      if (roleError) throw roleError;

      // Supprimer de users
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspace.id);

      if (userError) throw userError;

      toast({
        title: "Utilisateur retiré",
        description: "L'utilisateur a été retiré du workspace",
      });

      getWorkspaceUsers();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de retirer l'utilisateur",
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
                Équipe du workspace
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Gérez les utilisateurs et leurs rôles dans votre workspace
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
              Équipe du workspace
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Gérez les utilisateurs et leurs rôles dans votre workspace
            </p>
          </div>
          
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                INVITER UN UTILISATEUR
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un utilisateur</DialogTitle>
                <DialogDescription>
                  Invitez un nouvel utilisateur à rejoindre ce workspace
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="utilisateur@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rôle</Label>
                  <Select value={inviteRole} onValueChange={(value: "admin" | "gestionnaire") => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleInviteUser}
                    disabled={!inviteEmail.trim() || isInviting}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isInviting ? "Envoi..." : "Envoyer l'invitation"}
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
              Aucun utilisateur dans ce workspace pour le moment.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_auto_1fr_auto] gap-4 text-sm font-medium text-muted-foreground border-b pb-2 text-left">
              <div>Utilisateur</div>
              <div>Rôle</div>
              <div>Ajouté le</div>
              <div></div>
            </div>
            
            {users.map((user) => (
              <div key={user.user_id} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_auto_1fr_auto] gap-4 items-center p-4 border rounded-lg">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {user.first_name && user.last_name ? 
                        `${user.first_name} ${user.last_name}` : 
                        'Utilisateur'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 justify-start">
                  <Badge variant={getRoleBadgeVariant(user.user_roles[0]?.role)} className="flex items-center gap-1 whitespace-nowrap">
                    {React.createElement(getRoleIcon(user.user_roles[0]?.role), { className: "h-3 w-3" })}
                    {user.user_roles[0]?.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </div>
                
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
                        {user.user_roles[0]?.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleRemoveUser(user.user_id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Retirer du workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
