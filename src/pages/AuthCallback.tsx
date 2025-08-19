import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Gérer les tokens d'authentification depuis l'URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw new Error(`Erreur d'authentification: ${error.message}`);
        }

        // Extraire les paramètres d'invitation
        const type = searchParams.get('type');
        const workspaceId = searchParams.get('workspaceId');
        const role = searchParams.get('role');

        if (data.session?.user) {
          console.log('Utilisateur authentifié:', data.session.user.email);

          // Si c'est une invitation à un workspace
          if (type === 'invite' && workspaceId && role) {
            await handleWorkspaceInvitation(data.session.user, workspaceId, role);
          } else {
            // Redirection normale vers le dashboard
            navigate('/search');
          }
        } else {
          throw new Error('Aucune session utilisateur trouvée');
        }
      } catch (error: any) {
        console.error('Erreur lors du callback auth:', error);
        setError(error.message || 'Erreur lors de l\'authentification');
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  const handleWorkspaceInvitation = async (user: any, workspaceId: string, role: string) => {
    try {
      // Vérifier si l'utilisateur existe déjà dans ce workspace
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
        .single();

      if (existingUser) {
        toast({
          title: "Déjà membre",
          description: "Vous êtes déjà membre de ce workspace",
        });
        navigate('/search');
        return;
      }

      // Récupérer les informations du workspace
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single();

      const workspaceName = workspace?.name || 'Workspace';

      // Ajouter l'utilisateur au workspace
      const { error: userError } = await supabase
        .from('users')
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          company: workspaceName,
          email: user.email,
          plan_type: 'freemium',
          subscribed: false,
          assigned_by: user.id
        });

      if (userError) throw userError;

      // Assigner le rôle
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          role: role,
          assigned_by: user.id,
          is_supra_admin: false
        });

      if (roleError) throw roleError;

      // Créer les quotas par défaut (sans plan_type)
      const { error: quotaError } = await supabase
        .from('search_quotas')
        .insert({
          user_id: user.id,
          exports_limit: 10,
          clipboard_copies_limit: 50,
          favorites_limit: 100
        });

      if (quotaError) console.warn('Erreur quotas (non critique):', quotaError);

      toast({
        title: "Bienvenue !",
        description: `Vous avez rejoint le workspace "${workspaceName}" avec succès`,
      });

      navigate('/search');

    } catch (error: any) {
      console.error('Erreur lors de l\'ajout au workspace:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de rejoindre le workspace",
      });
      navigate('/search');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
            <CardTitle>Authentification en cours...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
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
            <CardTitle className="text-destructive">Erreur d'authentification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Authentification réussie</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Redirection en cours...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
