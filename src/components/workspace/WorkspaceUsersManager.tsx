import React, { useState, useEffect } from "react";
import { 
  getWorkspaceUsers, 
  inviteUserToWorkspace, 
  updateUserRoleInWorkspace, 
  removeUserFromWorkspace, 
  resendWorkspaceInvitation,
  type WorkspaceUser, 
  type PendingInvitation 
} from "@/lib/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Crown, 
  Eye, 
  MoreHorizontal, 
  Trash2, 
  RefreshCw, 
  Send,
  Clock,
  AlertTriangle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

interface InviteUserDialogProps {
  workspaceId: string;
  onInviteSent: () => void;
}

const InviteUserDialog = ({ workspaceId, onInviteSent }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<'admin' | 'gestionnaire'>('gestionnaire');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir une adresse email",
      });
      return;
    }

    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir une adresse email valide",
      });
      return;
    }

    setLoading(true);
    try {
      await inviteUserToWorkspace(workspaceId, email.toLowerCase().trim(), role);
      
      toast({
        title: "Invitation envoyée",
        description: `Une invitation a été envoyée à ${email}`,
      });

      setEmail("");
      setRole('gestionnaire');
      setOpen(false);
      onInviteSent();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi de l'invitation",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Inviter un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            Invitez un nouvel utilisateur à rejoindre votre workspace. Il recevra un email d'invitation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="utilisateur@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={(value: 'admin' | 'gestionnaire') => setRole(value)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestionnaire">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Gestionnaire</div>
                      <div className="text-xs text-muted-foreground">Accès lecture, export, copie, favoris</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Administrateur</div>
                      <div className="text-xs text-muted-foreground">Tous les droits sur le workspace</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Envoyer l'invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface UserRowProps {
  user: WorkspaceUser;
  currentUserId: string;
  workspaceId: string;
  onUserUpdated: () => void;
}

const UserRow = ({ user, currentUserId, workspaceId, onUserUpdated }: UserRowProps) => {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  
  const currentRole = user.user_roles[0]?.role || 'gestionnaire';
  const isCurrentUser = user.user_id === currentUserId;

  const handleRoleChange = async (newRole: 'admin' | 'gestionnaire') => {
    if (newRole === currentRole) return;

    setUpdating(true);
    try {
      await updateUserRoleInWorkspace(workspaceId, user.user_id, newRole);
      
      toast({
        title: "Rôle mis à jour",
        description: `Le rôle de ${user.first_name} ${user.last_name} a été mis à jour`,
      });
      
      onUserUpdated();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Erreur lors de la mise à jour du rôle",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveUser = async () => {
    setUpdating(true);
    try {
      await removeUserFromWorkspace(workspaceId, user.user_id);
      
      toast({
        title: "Utilisateur supprimé",
        description: `${user.first_name} ${user.last_name} a été retiré du workspace`,
      });
      
      onUserUpdated();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? Crown : Eye;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium">
              {user.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium">
              {user.first_name || user.last_name 
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                : 'Utilisateur'
              }
              {isCurrentUser && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Vous
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {updating ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Select
              value={currentRole}
              onValueChange={handleRoleChange}
              disabled={isCurrentUser}
            >
              <SelectTrigger className="w-auto border-0 h-auto p-0 bg-transparent">
                <Badge variant={getRoleBadgeVariant(currentRole)} className="gap-1">
                  {React.createElement(getRoleIcon(currentRole), { className: "h-3 w-3" })}
                  {currentRole === 'admin' ? 'Admin' : 'Gestionnaire'}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestionnaire">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Gestionnaire
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Administrateur
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(user.created_at)}
      </TableCell>
      <TableCell>
        {!isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={updating}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer du workspace
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir retirer <strong>{user.first_name} {user.last_name}</strong> du workspace ?
                      Cette action ne peut pas être annulée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveUser} className="bg-destructive hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

interface PendingInvitationRowProps {
  invitation: PendingInvitation;
  workspaceId: string;
  onInvitationUpdated: () => void;
}

const PendingInvitationRow = ({ invitation, workspaceId, onInvitationUpdated }: PendingInvitationRowProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResendInvitation = async () => {
    setLoading(true);
    try {
      await resendWorkspaceInvitation(workspaceId, invitation.id);
      
      toast({
        title: "Invitation renvoyée",
        description: `L'invitation a été renvoyée à ${invitation.email}`,
      });
      
      onInvitationUpdated();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Erreur lors du renvoi de l'invitation",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = () => {
    const expiresAt = new Date(invitation.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24;
  };

  return (
    <TableRow className="bg-muted/30">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
            <Clock className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <div className="font-medium">{invitation.email}</div>
            <div className="text-sm text-muted-foreground">Invitation en attente</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1">
          {invitation.role === 'admin' ? (
            <>
              <Crown className="h-3 w-3" />
              Admin
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Gestionnaire
            </>
          )}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div>Invité le {formatDate(invitation.created_at)}</div>
        <div className="flex items-center gap-1 text-xs">
          {isExpiringSoon() && <AlertTriangle className="h-3 w-3 text-orange-500" />}
          Expire le {formatDate(invitation.expires_at)}
        </div>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm" onClick={handleResendInvitation} disabled={loading}>
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Renvoyer
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export const WorkspaceUsersManager = () => {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchUsers = async () => {
    // Validation renforcée : vérifier que l'ID du workspace est valide
    if (!currentWorkspace?.id || currentWorkspace.id.trim() === '') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getWorkspaceUsers(currentWorkspace.id);
      setUsers(data.users);
      setPendingInvitations(data.pendingInvitations);
    } catch (error: any) {
      // Ne pas afficher de toast d'erreur si l'erreur vient d'un workspace_id vide
      if (error.message?.includes('workspace') || error.message?.includes('Workspace')) {
        console.warn('WorkspaceUsersManager: Invalid workspace ID, skipping user fetch');
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors du chargement des utilisateurs",
        });
        console.error('Error fetching users:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentWorkspace?.id]);

  if (!currentWorkspace) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Aucun workspace sélectionné
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Équipe du workspace
              </CardTitle>
              <CardDescription>
                Gérez les utilisateurs et leurs rôles dans votre workspace
              </CardDescription>
            </div>
            <InviteUserDialog 
              workspaceId={currentWorkspace.id} 
              onInviteSent={fetchUsers}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Ajouté le</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((workspaceUser) => (
                    <UserRow
                      key={workspaceUser.user_id}
                      user={workspaceUser}
                      currentUserId={user?.id || ''}
                      workspaceId={currentWorkspace.id}
                      onUserUpdated={fetchUsers}
                    />
                  ))}
                  {pendingInvitations.map((invitation) => (
                    <PendingInvitationRow
                      key={invitation.id}
                      invitation={invitation}
                      workspaceId={currentWorkspace.id}
                      onInvitationUpdated={fetchUsers}
                    />
                  ))}
                  {users.length === 0 && pendingInvitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Aucun utilisateur dans ce workspace
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingInvitations.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Clock className="h-5 w-5" />
              Invitations en attente ({pendingInvitations.length})
            </CardTitle>
            <CardDescription>
              Ces utilisateurs ont été invités mais n'ont pas encore accepté leur invitation
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};
