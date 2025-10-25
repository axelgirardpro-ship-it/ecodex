import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildLocalizedPath } from "@i18n/routing";
import { useLanguage } from "@/providers/LanguageProvider";

export const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();
  const { t } = useTranslation("pages", { keyPrefix: "authCallback" });
  const { t: tCommon } = useTranslation("common");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Gérer les tokens d'authentification depuis l'URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw new Error(t("errors.auth", { message: error.message ?? "" }));
        }

        // Extraire les paramètres d'invitation
        const type = searchParams.get('type');
        const workspaceId = searchParams.get('workspaceId');
        const role = searchParams.get('role');

        if (data.session?.user) {
          console.log('Utilisateur authentifié:', data.session.user.email);

          // Vérifier essai freemium expiré et rediriger vers login si nécessaire
          try {
            const { data: userData, error: userErr } = await supabase
              .from('users')
              .select('workspace_id')
              .eq('user_id', data.session.user.id)
              .single();

            if (!userErr && userData?.workspace_id) {
              const { data: hasAccess, error: accessErr } = await supabase
                .rpc('workspace_has_access', { workspace_uuid: userData.workspace_id });

              if (!accessErr && hasAccess === false) {
                try {
                  sessionStorage.setItem('trial_expired', 'true');
                } catch (storageError) {
                  console.warn('Impossible de persister le flag trial_expired', storageError);
                }
                await supabase.auth.signOut();
                navigate(`${buildLocalizedPath('/login', language)}?trial_expired=true`);
                return;
              }
            }
          } catch (verifyError) {
            console.warn('Vérification essai expiré (OAuth) échouée:', verifyError);
          }

          // Si c'est une invitation à un workspace
          if (type === 'invite' && workspaceId && role) {
            await handleWorkspaceInvitation(data.session.user, workspaceId, role);
          } else {
            // Redirection normale vers le dashboard
            navigate(buildLocalizedPath('/search', language));
          }
        } else {
          throw new Error(t('errors.noSession'));
        }
      } catch (err) {
        console.error('Erreur lors du callback auth:', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message || t('errors.generic'));
      } finally {
        setLoading(false);
      }
    };

    void handleAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate, language, t]);

  const handleWorkspaceInvitation = async (
    user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
    workspaceId: string,
    role: string
  ) => {
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
          title: t('toasts.alreadyMember.title'),
          description: t('toasts.alreadyMember.description'),
        });
        navigate(buildLocalizedPath('/search', language));
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
          workspace_id: workspaceId,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          company: workspaceName,
          email: user.email,
          plan_type: 'freemium',
          subscribed: false,
          assigned_by: user.id
        } as any);

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
          // Valeurs par défaut freemium
          exports_limit: 10,
          clipboard_copies_limit: 10,
          favorites_limit: 10
        });

      if (quotaError) console.warn('Erreur quotas (non critique):', quotaError);

      toast({
        title: (t as any)('toasts.welcome.title'),
        description: (t as any)('toasts.welcome.description', { workspace: workspaceName }),
      });

      navigate(buildLocalizedPath('/search', language));

    } catch (err) {
      console.error('Erreur lors de l\'ajout au workspace:', err);
      toast({
        variant: "destructive",
        title: (t as any)('toasts.joinError.title'),
        description: (t as any)('toasts.joinError.description'),
      });
      navigate(buildLocalizedPath('/search', language));
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
          <CardTitle>{t('loadingTitle')}</CardTitle>
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
            <CardTitle className="text-destructive">{t('errorTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">{error ?? t('errors.generic')}</p>
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
          <CardTitle>{t('successTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            {t('redirectMessage')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
