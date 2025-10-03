import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, X-Client-Info, apikey, content-type, Content-Type',
}

interface UpdateRequest {
  action: 'update_workspace_plan' | 'update_user_role' | 'update_user_plan';
  workspaceId?: string;
  userId?: string;
  newPlan?: 'freemium' | 'pro';
  newRole?: 'admin' | 'gestionnaire' | 'lecteur';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the user from the request
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is supra admin
    const { data: isSupraAdmin } = await supabaseClient
      .rpc('is_supra_admin', { user_uuid: user.id })

    if (!isSupraAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé - Supra admin requis' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestBody = await req.json()
    console.log('Request body:', JSON.stringify(requestBody))
    const { action, workspaceId, userId, newPlan, newRole }: UpdateRequest = requestBody

    if (action === 'update_workspace_plan' && workspaceId && newPlan) {
      console.log(`Updating workspace plan: ${workspaceId} to ${newPlan}`)
      
      // Update workspace plan
      const { error: workspaceError } = await supabaseClient
        .from('workspaces')
        .update({ plan_type: newPlan, updated_at: new Date().toISOString() })
        .eq('id', workspaceId)

      if (workspaceError) {
        console.error('Workspace update error:', workspaceError)
        throw workspaceError
      }

      // Get all user IDs in this workspace via user_roles
      console.log('Getting users for workspace via user_roles:', workspaceId)
      const { data: userRoles, error: userRolesError } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('workspace_id', workspaceId)
      
      if (userRolesError) {
        console.error('User roles query error:', userRolesError)
        throw userRolesError
      }

      console.log('Found user roles:', userRoles?.length)

      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map(ur => ur.user_id)
        console.log('User IDs to update quotas for:', userIds)
        
        // Update search quotas based on new plan
        let quotaUpdates: Record<string, any> = {}
        switch (newPlan) {
          case 'freemium':
            quotaUpdates = { exports_limit: 10, clipboard_copies_limit: 10, favorites_limit: 10 }
            break
          case 'pro':
            quotaUpdates = { exports_limit: 1000, clipboard_copies_limit: 1000, favorites_limit: null }
            break
          default:
            throw new Error(`Invalid plan type: ${newPlan}. Must be 'freemium' or 'pro'.`)
        }

        console.log('Updating quotas with:', quotaUpdates)
        const { error: quotasError } = await supabaseClient
          .from('search_quotas')
          .update({ ...quotaUpdates, updated_at: new Date().toISOString() })
          .in('user_id', userIds)

        if (quotasError) {
          console.error('Quotas update error:', quotasError)
          throw quotasError
        }
        console.log('Quotas updated successfully')
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Plan du workspace mis à jour vers ${newPlan}`,
          updatedUsers: userRoles?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update_user_role' && userId && workspaceId && newRole) {
      console.log(`Updating user role: ${userId} in workspace ${workspaceId} to ${newRole}`)
      
      // Update user role in specific workspace
      const { error } = await supabaseClient
        .from('user_roles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)

      if (error) {
        console.error('User role update error:', error)
        throw error
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Rôle utilisateur mis à jour vers ${newRole}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update_user_plan' && userId && newPlan) {
      console.log(`Updating user plan: ${userId} to ${newPlan}`)
      
      // Get user's workspace via user_roles
      const { data: userRole, error: userRoleError } = await supabaseClient
        .from('user_roles')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      
      if (userRoleError) {
        console.error('User role lookup error:', userRoleError)
        throw userRoleError
      }
      
      if (!userRole?.workspace_id) {
        throw new Error('Workspace non trouvé pour cet utilisateur')
      }
      
      console.log('Found workspace for user:', userRole.workspace_id)
      
      // Update workspace plan instead of user plan (since plan is at workspace level)
      const { error: workspaceError } = await supabaseClient
        .from('workspaces')
        .update({ plan_type: newPlan, updated_at: new Date().toISOString() })
        .eq('id', userRole.workspace_id)

      if (workspaceError) {
        console.error('Workspace plan update error:', workspaceError)
        throw workspaceError
      }

      // Update user's search quotas
      let quotaUpdates: Record<string, any> = {}
      switch (newPlan) {
        case 'freemium':
          quotaUpdates = { exports_limit: 10, clipboard_copies_limit: 10, favorites_limit: 10 }
          break
        case 'pro':
          quotaUpdates = { exports_limit: 1000, clipboard_copies_limit: 1000, favorites_limit: null }
          break
        default:
          throw new Error(`Invalid plan type: ${newPlan}. Must be 'freemium' or 'pro'.`)
      }

      console.log('Updating user quota with:', quotaUpdates)
      const { error: quotaError } = await supabaseClient
        .from('search_quotas')
        .update({ ...quotaUpdates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (quotaError) {
        console.error('User quota update error:', quotaError)
        throw quotaError
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Plan utilisateur mis à jour vers ${newPlan}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Invalid action or missing parameters:', { action, workspaceId, userId, newPlan, newRole })
    return new Response(
      JSON.stringify({ error: 'Action invalide ou paramètres manquants', receivedParams: { action, workspaceId, userId, newPlan, newRole } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in update-user-plan-role function:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})