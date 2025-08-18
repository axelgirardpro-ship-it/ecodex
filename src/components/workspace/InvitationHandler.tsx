import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mail, 
  Building, 
  Crown, 
  Eye, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface InvitationData {
  workspace_id?: string;
  workspace_name?: string;
  role?: string;
  invitation_type?: string;
}

export const InvitationHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");

  // Paramètres pour le flux natif Supabase (multiple formats possibles)
  const workspaceId = searchParams.get('workspaceId') || searchParams.get('workspace_id');
  const role = searchParams.get('role');
  
  // Paramètres d'authentification Supabase (depuis URL params ou hash)
  const getTokenFromUrlOrHash = (paramName: string) => {
    // D'abord essayer les paramètres URL normaux
    const fromUrl = searchParams.get(paramName);
    if (fromUrl) return fromUrl;
    
    // Ensuite essayer depuis le hash
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(paramName);
  };

  const accessToken = getTokenFromUrlOrHash('access_token');
  const refreshToken = getTokenFromUrlOrHash('refresh_token');
  const type = getTokenFromUrlOrHash('type');

  useEffect(() => {
    const handleInvitation = async () => {
      try {
        // Si on reçoit des tokens d'authentification, les traiter d'abord
        if (accessToken && type === 'invite') {
          console.log('Traitement de l\'invitation avec tokens Supabase');
          
          // Établir la session avec les tokens reçus
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });

          if (error) {
            throw new Error(`Erreur d'authentification: ${error.message}`);
          }

          console.log('Session établie avec succès:', data.user?.email);
          
          // Attendre que le contexte Auth se mette à jour
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          
          return;
        }
        
        // Vérifier si l'utilisateur est déjà connecté et traiter l'invitation automatiquement
        if (user && workspaceId && role) {
          handleAutoAcceptInvitation();
        } else if (user && !workspaceId) {
          // Utilisateur connecté mais pas de paramètres d'invitation spécifiques
          // Vérifier s'il a des invitations en attente dans ses métadonnées
          const userMetadata = user.user_metadata;
          if (userMetadata?.workspace_id && userMetadata?.role) {
            console.log('Invitation trouvée dans les métadonnées utilisateur:', userMetadata);
            setInvitation({
              workspace_id: userMetadata.workspace_id,
              role: userMetadata.role,
              workspace_name: userMetadata.workspace_name || 'Workspace'
            });
            handleAutoAcceptInvitation();
          } else {
            // Pas d'invitation trouvée, rediriger vers l'accueil
            navigate('/search');
          }
        } else {
          // Préparer les données d'invitation pour affichage
          if (workspaceId && role) {
            setInvitation({
              workspace_id: workspaceId,
              role: role,
              workspace_name: 'Workspace' // On récupérera le vrai nom plus tard
            });
            fetchWorkspaceName();
          } else {
            setError("Aucune invitation trouvée. Connectez-vous d'abord via le Magic Link reçu par email.");
          }
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Erreur lors du traitement de l\'invitation:', error);
        setError(error.message || 'Erreur lors du traitement de l\'invitation');
        setLoading(false);
      }
    };

    handleInvitation();
  }, [user, workspaceId, role, accessToken, type, refreshToken]);

  const fetchWorkspaceName = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single();
      
      if (!error && data) {
        setInvitation(prev => prev ? { ...prev, workspace_name: data.name } : null);
        setCompany(data.name);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nom du workspace:', error);
    }
  };

  const handleAutoAcceptInvitation = async () => {
    const finalWorkspaceId = workspaceId || user?.user_metadata?.workspace_id;
    const finalRole = role || user?.user_metadata?.role;
    const finalWorkspaceName = company || user?.user_metadata?.workspace_name || 'Workspace';
    
    if (!user || !finalWorkspaceId || !finalRole) {
      console.error('Données insuffisantes pour accepter l\'invitation:', { user: !!user, workspaceId: finalWorkspaceId, role: finalRole });
      return;
    }

    try {
      setProcessing(true);
      
      // Ajouter l'utilisateur au workspace
      const { error: userError } = await supabase
        .from('users')
        .insert({
          user_id: user.id,
          workspace_id: finalWorkspaceId,
          first_name: firstName || user.user_metadata?.first_name || '',
          last_name: lastName || user.user_metadata?.last_name || '',
          company: finalWorkspaceName,
          email: user.email || '',
          plan_type: 'freemium',
          subscribed: false,
          assigned_by: user.id
        });

      if (userError) throw userError;

      // Ajouter le rôle
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          workspace_id: finalWorkspaceId,
          role: finalRole,
          assigned_by: user.id,
          is_supra_admin: false
        });

      if (roleError) throw roleError;

      // Supprimer l'invitation acceptée de la table
      try {
        await supabase
          .from('workspace_invitations')
          .delete()
          .eq('email', user.email)
          .eq('workspace_id', finalWorkspaceId);
        
        console.log('Invitation supprimée après acceptation');
      } catch (deleteError) {
        console.warn('Erreur lors de la suppression de l\'invitation:', deleteError);
        // Ne pas faire échouer le processus pour cette erreur
      }

      toast({
        title: "Invitation acceptée !",
        description: "Vous avez rejoint le workspace avec succès",
      });

      navigate('/search');
    } catch (error: any) {
      console.error('Erreur lors de l\'acceptation automatique:', error);
      setError(error.message || "Erreur lors de l'acceptation de l'invitation");
      setLoading(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleLoginAndAccept = () => {
    // Rediriger vers la page de connexion avec les paramètres d'invitation
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('workspaceId', workspaceId || '');
    loginUrl.searchParams.set('role', role || '');
    loginUrl.searchParams.set('action', 'accept_invitation');
    navigate(loginUrl.pathname + loginUrl.search);
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? Crown : Eye;
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  const getRoleDescription = (role: string) => {
    if (role === 'admin') {
      return "Vous aurez tous les droits sur le workspace : gestion d'équipe, import de données, configuration, etc.";
    }
    return "Vous pourrez consulter, exporter, copier et ajouter aux favoris les données du workspace.";
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Invitation invalide</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
              variant="outline"
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Invitation à rejoindre un workspace</CardTitle>
          <CardDescription>
            Vous avez été invité(e) à rejoindre <strong>{invitation.workspace_name}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Détails de l'invitation */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{invitation.workspace_name}</div>
                  <div className="text-sm text-muted-foreground">Workspace</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                {React.createElement(getRoleIcon(invitation.role), { 
                  className: "h-5 w-5 text-muted-foreground" 
                })}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {invitation.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
                    </span>
                    <Badge variant={getRoleBadgeVariant(invitation.role)} size="sm">
                      {invitation.role === 'admin' ? 'Admin' : 'Gestionnaire'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">Votre rôle</div>
                </div>
              </div>
            </div>

            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Vous devez vous connecter ou créer un compte pour accepter cette invitation.
              </AlertDescription>
            </Alert>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">
                Permissions associées à votre rôle :
              </div>
              <div className="text-sm text-blue-800">
                {getRoleDescription(invitation.role)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Ignorer
            </Button>
            
            <Button 
              onClick={handleLoginAndAccept}
              className="flex-1"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Se connecter et accepter
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            En acceptant cette invitation, vous acceptez de rejoindre le workspace avec le rôle attribué.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
