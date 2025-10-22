import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InviteUserRequest {
  action: 'invite_user';
  email: string;
  role: 'admin' | 'gestionnaire';
  workspaceId: string;
}

interface UpdateRoleRequest {
  action: 'update_role';
  userId: string;
  workspaceId: string;
  newRole: 'admin' | 'gestionnaire';
}

interface RemoveUserRequest {
  action: 'remove_user';
  userId: string;
  workspaceId: string;
}

interface GetUsersRequest {
  action: 'get_users';
  workspaceId: string;
}

interface ResendInvitationRequest {
  action: 'resend_invitation';
  invitationId: string;
  workspaceId: string;
}

type RequestBody = InviteUserRequest | UpdateRoleRequest | RemoveUserRequest | GetUsersRequest | ResendInvitationRequest;

// Générer un token sécurisé pour les invitations
function generateInvitationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Vérifier si l'utilisateur est admin du workspace
async function isWorkspaceAdmin(supabase: any, userId: string, workspaceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return false;
  return data.role === 'admin';
}

// Vérifier si l'utilisateur est propriétaire du workspace
async function isWorkspaceOwner(supabase: any, userId: string, workspaceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (error || !data) return false;
  return data.owner_id === userId;
}

// Envoyer une invitation via Magic Link OTP (approche 100% native)
async function sendSupabaseInvitation(supabase: any, email: string, workspaceName: string, role: string, workspaceId: string): Promise<{ success: boolean; reason?: string }> {
  try {
    console.log(`Envoi Magic Link d'invitation pour ${email} vers ${workspaceName}`);
    
    // Utiliser signInWithOtp SANS redirection automatique avec expiration plus longue
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        // PAS de emailRedirectTo pour éviter les appels serveur-to-serveur
        shouldCreateUser: true, // Créer l'utilisateur s'il n'existe pas
        data: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          role: role,
          invitation_type: 'workspace'
        }
      }
    });

    if (error) {
      console.error('Erreur Magic Link Supabase:', error);
      return { success: false, reason: 'api_error' };
    }

    console.log(`Magic Link envoyé avec succès à ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'envoi du Magic Link:', error);
    return { success: false, reason: 'exception' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[manage-workspace-users] No Authorization header')
      throw new Error('Pas d\'en-tête d\'autorisation');
    }

    const token = authHeader.replace('Bearer ', '')
    
    console.log('[manage-workspace-users] Validating JWT')
    console.log('[manage-workspace-users] Token starts with:', token.substring(0, 20))
    
    // Décoder le JWT pour obtenir le payload (sans vérification de signature)
    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      userId = payload.sub
      
      if (!userId) {
        throw new Error('No user ID in JWT')
      }
      
      console.log('[manage-workspace-users] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[manage-workspace-users] Failed to decode JWT:', error)
      throw new Error('Invalid JWT format: ' + error.message)
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser) {
      console.error('[manage-workspace-users] User validation failed:', authError)
      throw new Error('Invalid user: ' + authError?.message)
    }

    const user = authUser.user
    console.log('[manage-workspace-users] User authenticated successfully:', user.id)

    const requestBody: RequestBody = await req.json();
    const { action } = requestBody;

    // Vérifications de permissions communes
    if (action !== 'get_users') {
      const workspaceId = 'workspaceId' in requestBody ? requestBody.workspaceId : '';
      
      // Validation du workspace ID pour toutes les actions sauf get_users
      if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
        throw new Error('ID du workspace manquant ou invalide');
      }
      
      // Vérifier que l'utilisateur est admin du workspace ou propriétaire
      const isAdmin = await isWorkspaceAdmin(supabase, user.id, workspaceId);
      const isOwner = await isWorkspaceOwner(supabase, user.id, workspaceId);
      
      // Vérifier si c'est un supra admin
      const { data: isSupraAdmin } = await supabase.rpc('is_supra_admin', { user_uuid: user.id });
      
      if (!isAdmin && !isOwner && !isSupraAdmin) {
        throw new Error('Permissions insuffisantes - Admin ou propriétaire requis');
      }
    }

    switch (action) {
      case 'invite_user': {
        const { email, role, workspaceId } = requestBody;

        // Validation des données
        if (!email || !role || !workspaceId) {
          throw new Error('Paramètres manquants pour l\'invitation');
        }

        if (!['admin', 'gestionnaire'].includes(role)) {
          throw new Error('Rôle invalide');
        }

        // Vérifier que l'email n'est pas déjà dans le workspace
        const { data: existingUser } = await supabase
          .from('users')
          .select('email')
          .eq('email', email.toLowerCase())
          .eq('workspace_id', workspaceId)
          .single();

        if (existingUser) {
          throw new Error('Cet utilisateur fait déjà partie du workspace');
        }

        // Vérifier s'il y a déjà une invitation en attente
        const { data: existingInvitation } = await supabase
          .from('workspace_invitations')
          .select('id, status')
          .eq('email', email.toLowerCase())
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending')
          .single();

        if (existingInvitation) {
          throw new Error('Une invitation est déjà en attente pour cet email');
        }

        // Générer token d'invitation
        const token = generateInvitationToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

        // Créer l'invitation
        const { data: invitation, error: invitationError } = await supabase
          .from('workspace_invitations')
          .insert({
            email: email.toLowerCase(),
            workspace_id: workspaceId,
            role,
            invited_by: user.id,
            token,
            expires_at: expiresAt.toISOString(),
            status: 'pending'
          })
          .select()
          .single();

        if (invitationError) {
          throw new Error(`Erreur lors de la création de l'invitation: ${invitationError.message}`);
        }

        // Récupérer les infos du workspace et de l'inviteur
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspaceId)
          .single();

        const { data: inviterData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single();

        const workspaceName = workspaceData?.name || 'Workspace';
        const inviterName = inviterData ? `${inviterData.first_name} ${inviterData.last_name}`.trim() : 'Un administrateur';

        // Envoyer l'invitation via Supabase Auth natif
        const invitationResult = await sendSupabaseInvitation(supabase, email, workspaceName, role, workspaceId);
        
        if (!invitationResult.success) {
          if (invitationResult.reason === 'user_exists') {
            // L'utilisateur existe déjà - garder l'invitation mais informer l'admin
            console.log(`Invitation créée pour utilisateur existant: ${email}`);
            
            return new Response(
              JSON.stringify({
                success: true,
                message: `Invitation créée pour ${email}. Cet utilisateur existe déjà et peut se connecter pour accepter l'invitation.`,
                warning: 'Utilisateur existant - aucun email envoyé'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            // Erreur technique - supprimer l'invitation
            await supabase
              .from('workspace_invitations')
              .delete()
              .eq('id', invitation.id);
            throw new Error('Erreur technique lors de l\'envoi de l\'invitation');
          }
        }

        // Log pour audit
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'invite_user',
            details: {
              invited_email: email,
              workspace_id: workspaceId,
              role,
              invitation_id: invitation.id
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Magic Link envoyé à ${email}. L'utilisateur doit cliquer sur le lien dans l'email puis se rendre sur votre application pour accepter l'invitation.`,
            invitation,
            instructions: `Demandez à ${email} de : 1) Cliquer sur le Magic Link dans l'email, 2) Se rendre sur ${Deno.env.get('SITE_URL')}, 3) L'invitation apparaîtra automatiquement.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_role': {
        const { userId, workspaceId, newRole } = requestBody;

        // Validation
        if (!userId || !workspaceId || !newRole) {
          throw new Error('Paramètres manquants pour la mise à jour du rôle');
        }

        if (!['admin', 'gestionnaire'].includes(newRole)) {
          throw new Error('Rôle invalide');
        }

        // Vérifier que l'utilisateur cible existe dans le workspace
        const { data: targetUser, error: targetUserError } = await supabase
          .from('user_roles')
          .select('role, user_id')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .single();

        if (targetUserError || !targetUser) {
          throw new Error('Utilisateur non trouvé dans ce workspace');
        }

        // Empêcher de se retirer ses propres droits admin si c'est le seul admin
        if (userId === user.id && targetUser.role === 'admin' && newRole !== 'admin') {
          const { data: adminCount } = await supabase
            .from('user_roles')
            .select('user_id', { count: 'exact' })
            .eq('workspace_id', workspaceId)
            .eq('role', 'admin');

          if (adminCount && adminCount.length <= 1) {
            throw new Error('Impossible de retirer vos droits admin : vous êtes le seul administrateur du workspace');
          }
        }

        // Mettre à jour le rôle
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ 
            role: newRole, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId);

        if (updateError) {
          throw new Error(`Erreur lors de la mise à jour du rôle: ${updateError.message}`);
        }

        // Log pour audit
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'update_user_role',
            details: {
              target_user_id: userId,
              workspace_id: workspaceId,
              old_role: targetUser.role,
              new_role: newRole
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Rôle mis à jour vers ${newRole}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove_user': {
        const { userId, workspaceId } = requestBody;

        // Validation
        if (!userId || !workspaceId) {
          throw new Error('Paramètres manquants pour la suppression');
        }

        // Empêcher l'auto-suppression
        if (userId === user.id) {
          throw new Error('Vous ne pouvez pas vous supprimer vous-même du workspace');
        }

        // Vérifier que l'utilisateur existe dans le workspace
        const { data: targetUser, error: targetUserError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .single();

        if (targetUserError || !targetUser) {
          throw new Error('Utilisateur non trouvé dans ce workspace');
        }

        // Supprimer l'utilisateur du workspace (cascade sur user_roles via FK)
        const { error: deleteUserError } = await supabase
          .from('users')
          .delete()
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId);

        if (deleteUserError) {
          throw new Error(`Erreur lors de la suppression: ${deleteUserError.message}`);
        }

        // Supprimer aussi de user_roles (au cas où il n'y aurait pas de cascade)
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId);

        // Log pour audit
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'remove_user',
            details: {
              removed_user_id: userId,
              workspace_id: workspaceId,
              removed_role: targetUser.role
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Utilisateur supprimé du workspace'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_users': {
        const { workspaceId } = requestBody;

        // Validation renforcée
        if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
          throw new Error('ID du workspace manquant ou invalide');
        }

        // Vérifier que l'utilisateur a accès au workspace
        const { data: userAccess } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single();

        const { data: isSupraAdmin } = await supabase.rpc('is_supra_admin', { user_uuid: user.id });

        if (!userAccess && !isSupraAdmin) {
          throw new Error('Accès refusé à ce workspace');
        }

        // Récupérer les utilisateurs du workspace avec requête SQL directe
        const { data: workspaceUsers, error: usersError } = await supabase
          .rpc('get_workspace_users_with_roles', { 
            target_workspace_id: workspaceId 
          });

        if (usersError) {
          throw new Error(`Erreur lors de la récupération des utilisateurs: ${usersError.message}`);
        }

        // Récupérer les invitations en attente
        const { data: pendingInvitations, error: invitationsError } = await supabase
          .from('workspace_invitations')
          .select('id, email, role, created_at, expires_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (invitationsError) {
          console.error('Erreur lors de la récupération des invitations:', invitationsError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            users: workspaceUsers || [],
            pendingInvitations: pendingInvitations || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resend_invitation': {
        const { invitationId, workspaceId } = requestBody;

        // Validation
        if (!invitationId || !workspaceId) {
          throw new Error('Paramètres manquants pour renvoyer l\'invitation');
        }

        // Récupérer l'invitation
        const { data: invitation, error: invitationError } = await supabase
          .from('workspace_invitations')
          .select('*')
          .eq('id', invitationId)
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending')
          .single();

        if (invitationError || !invitation) {
          throw new Error('Invitation non trouvée ou déjà acceptée');
        }

        // Générer un nouveau token et prolonger l'expiration
        const newToken = generateInvitationToken();
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        // Mettre à jour l'invitation
        const { error: updateError } = await supabase
          .from('workspace_invitations')
          .update({
            token: newToken,
            expires_at: newExpiresAt.toISOString()
          })
          .eq('id', invitationId);

        if (updateError) {
          throw new Error(`Erreur lors de la mise à jour de l'invitation: ${updateError.message}`);
        }

        // Récupérer les infos pour l'email
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('name')
          .eq('id', workspaceId)
          .single();

        const { data: inviterData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single();

        const workspaceName = workspaceData?.name || 'Workspace';
        const inviterName = inviterData ? `${inviterData.first_name} ${inviterData.last_name}`.trim() : 'Un administrateur';

        // Essayer de renvoyer l'invitation
        const invitationResult = await sendSupabaseInvitation(supabase, invitation.email, workspaceName, invitation.role, workspaceId);
        
        if (!invitationResult.success) {
          if (invitationResult.reason === 'user_exists') {
            // L'utilisateur existe déjà
            return new Response(
              JSON.stringify({
                success: true,
                message: `L'utilisateur ${invitation.email} existe déjà. Il peut se connecter normalement et accepter l'invitation.`,
                info: 'Utilisateur existant - aucun email envoyé'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            // Erreur technique mais on garde l'invitation valide
            return new Response(
              JSON.stringify({
                success: true,
                message: `Token de l'invitation mis à jour pour ${invitation.email}. L'utilisateur peut utiliser le lien d'invitation existant.`,
                warning: 'Email non envoyé automatiquement - erreur technique'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Log pour audit
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'resend_invitation',
            details: {
              invitation_id: invitationId,
              email: invitation.email,
              workspace_id: workspaceId
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Invitation renvoyée à ${invitation.email}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Action non reconnue');
    }

  } catch (error) {
    console.error('Erreur dans manage-workspace-users:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erreur interne du serveur',
        success: false
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

