/**
 * Edge Function: invite-user
 * Invite un utilisateur à rejoindre un workspace avec validation des permissions et limites
 */
// @ts-ignore Deno runtime types
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AUTH_LIST_USERS_PAGE_SIZE = 200;
const AUTH_LIST_USERS_MAX_PAGES = 25;

interface InviteUserRequest {
  email: string;
  workspaceId: string;
  role: string;
  redirectTo?: string;
}

interface UserLimitCheck {
  allowed: boolean;
  current_count: number;
  max_users: number;
  error?: string;
}

interface JWTPayload {
  sub: string;
  [key: string]: unknown;
}

async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<{ id: string; email?: string; user_metadata?: Record<string, unknown> } | null> {
  const emailLower = email.toLowerCase();

  for (let page = 1; page <= AUTH_LIST_USERS_MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: AUTH_LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      console.error('Error fetching auth users page', page, error);
      throw new Error('Failed to list auth users');
    }

    const users = data?.users ?? [];
    const match = users.find((candidate) => {
      const candidateEmail = typeof candidate.email === 'string' ? candidate.email.toLowerCase() : '';
      return candidateEmail === emailLower;
    });

    if (match) {
      return match;
    }

    if (users.length < AUTH_LIST_USERS_PAGE_SIZE) {
      break;
    }
  }

  return null;
}

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore Deno.env
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore Deno.env
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[invite-user] No Authorization header')
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '')
    
    console.log('[invite-user] Validating JWT')
    console.log('[invite-user] Token starts with:', token.substring(0, 20))
    
    // Décoder le JWT pour obtenir le payload (sans vérification de signature)
    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload
      userId = payload.sub
      
      if (!userId) {
        throw new Error('No user ID in JWT')
      }
      
      console.log('[invite-user] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[invite-user] Failed to decode JWT:', error)
      throw new Error('Invalid JWT format: ' + error.message)
    }
    
    // Create Supabase admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser) {
      console.error('[invite-user] User validation failed:', authError)
      throw new Error('Invalid user: ' + authError?.message)
    }

    const user = authUser.user
    console.log('[invite-user] User authenticated successfully:', user.id)

    // Get request body
    const { email, workspaceId, role, redirectTo } = await req.json() as InviteUserRequest;

    if (!email || !workspaceId || !role) {
      throw new Error('Missing required parameters: email, workspaceId, role');
    }

    // Verify the user has permission to invite to this workspace
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (roleError || !userRole || (userRole.role !== 'admin' && userRole.role !== 'supra_admin')) {
      throw new Error('Insufficient permissions - admin role required');
    }

    // Get workspace name for invitation data
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    const workspaceName = workspace?.name || 'Workspace';

    console.log(`Inviting ${email} to workspace ${workspaceName} with role ${role}`);

    // Check workspace user limit before sending invitation
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_workspace_user_limit', { p_workspace_id: workspaceId }) as { data: UserLimitCheck | null; error: unknown }

    if (limitError) {
      console.error('Limit check error:', limitError)
      throw new Error('Erreur lors de la vérification de la limite d\'utilisateurs')
    }

    console.log('Limit check result:', limitCheck)

    if (!limitCheck || !limitCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'user limit exceeded',
          message: limitCheck?.error || `Limite d'utilisateurs atteinte (${limitCheck?.current_count ?? 0}/${limitCheck?.max_users ?? 0}). Veuillez passer à un plan supérieur.`,
          current_count: limitCheck?.current_count ?? 0,
          max_users: limitCheck?.max_users ?? 0,
          success: false
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const emailLower = email.toLowerCase().trim();

    // On ne peut pas vérifier directement dans auth.users depuis une Edge Function
    // On va donc essayer d'inviter et gérer les erreurs

    // Send invitation using admin API
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      emailLower,
      {
        redirectTo: redirectTo || `${req.headers.get('origin') || 'https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com'}/auth/callback?type=invite&workspaceId=${workspaceId}&role=${role}`,
        data: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          role: role,
          invitation_type: 'workspace'
        }
      }
    );

    if (error) {
      console.warn('Supabase invitation error, attempting fallback:', error);

      const isDuplicate = typeof error.message === 'string' && (
        error.message.includes('already been registered') ||
        error.message.includes('Database error saving new user')
      );

      if (isDuplicate) {
        console.log(`User ${emailLower} already exists, attempting to link to workspace via admin listUsers`);

        const authUser = await findAuthUserByEmail(supabase, emailLower);

        if (!authUser) {
          console.log('Existing auth user not found via admin listUsers; invitation already sent by Supabase.');
          return new Response(
            JSON.stringify({
              success: true,
              alreadyExists: false,
              code: 'invite-sent-pending',
              message: 'Invitation sent by Supabase. User not yet present in auth.users.'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }

        const existingUserId = String(authUser.id);
        const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
        const firstNameFromMetadata = typeof metadata.first_name === 'string' ? metadata.first_name : '';
        const lastNameFromMetadata = typeof metadata.last_name === 'string' ? metadata.last_name : '';

        let normalizedFirstName = firstNameFromMetadata;
        let normalizedLastName = lastNameFromMetadata;
        let normalizedCompany = workspaceName;

        const { data: existingAnyWorkspace } = await supabase
          .from('users')
          .select('first_name, last_name, company')
          .eq('user_id', existingUserId)
          .order('created_at', { ascending: true })
          .limit(1);

        if (existingAnyWorkspace && existingAnyWorkspace.length > 0) {
          normalizedFirstName = normalizedFirstName || existingAnyWorkspace[0].first_name || '';
          normalizedLastName = normalizedLastName || existingAnyWorkspace[0].last_name || '';
          normalizedCompany = existingAnyWorkspace[0].company || normalizedCompany;
        }

        const { data: existingUserRecord } = await supabase
          .from('users')
          .select('id')
          .eq('user_id', existingUserId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (!existingUserRecord) {
          const { error: userError } = await supabase
            .from('users')
            .insert({
              user_id: existingUserId,
              workspace_id: workspaceId,
              first_name: normalizedFirstName,
              last_name: normalizedLastName,
              company: normalizedCompany,
              email: emailLower,
              plan_type: 'freemium',
              subscribed: false,
              assigned_by: user.id
            });

          if (userError) {
            console.error('Error inserting user in fallback:', userError);
            throw new Error('Failed to add user to workspace');
          }
        }

        const { data: existingRoleRecord } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUserId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (!existingRoleRecord) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: existingUserId,
              workspace_id: workspaceId,
              role,
              assigned_by: user.id,
              is_supra_admin: role === 'supra_admin'
            });

          if (roleError) {
            console.error('Error inserting role in fallback:', roleError);
            throw new Error('Failed to assign role to user');
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            alreadyExists: true,
            code: 'existing-user-linked'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      throw error;
    }

    console.log('Invitation sent successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        code: 'invite-sent',
        data: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi de l\'invitation';
    console.error('Invitation error:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
