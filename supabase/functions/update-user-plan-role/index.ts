import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateRequest {
  action: 'update_workspace_plan' | 'update_user_role' | 'update_user_plan';
  workspaceId?: string;
  userId?: string;
  newPlan?: 'freemium' | 'standard' | 'premium';
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

      if (workspaceError) throw workspaceError

      // Update all users in this workspace
      const { error: usersError } = await supabaseClient
        .from('users')
        .update({ plan_type: newPlan, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)

      if (usersError) throw usersError

      // Get all user IDs in this workspace to update quotas
      const { data: workspaceUsers } = await supabaseClient
        .from('users')
        .select('user_id')
        .eq('workspace_id', workspaceId)

      if (workspaceUsers) {
        const userIds = workspaceUsers.map(u => u.user_id)
        
        // Update search quotas based on new plan
        let quotaUpdates: Record<string, any> = {}
        switch (newPlan) {
          case 'freemium':
            quotaUpdates = { plan_type: 'freemium', exports_limit: 0, clipboard_copies_limit: 10, favorites_limit: 10 }
            break
          case 'standard':
            quotaUpdates = { plan_type: 'standard', exports_limit: 100, clipboard_copies_limit: 100, favorites_limit: 100 }
            break
          case 'premium':
            quotaUpdates = { plan_type: 'premium', exports_limit: null, clipboard_copies_limit: null, favorites_limit: null }
            break
        }

        const { error: quotasError } = await supabaseClient
          .from('search_quotas')
          .update({ ...quotaUpdates, updated_at: new Date().toISOString() })
          .in('user_id', userIds)

        if (quotasError) throw quotasError
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Plan du workspace mis à jour vers ${newPlan}`,
          updatedUsers: workspaceUsers?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update_user_role' && userId && workspaceId && newRole) {
      // Update user role in specific workspace
      const { error } = await supabaseClient
        .from('user_roles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Rôle utilisateur mis à jour vers ${newRole}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update_user_plan' && userId && newPlan) {
      // Update individual user plan (for direct user plan changes)
      const { error: userError } = await supabaseClient
        .from('users')
        .update({ plan_type: newPlan, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (userError) throw userError

      // Update user's search quotas
      let quotaUpdates: Record<string, any> = {}
      switch (newPlan) {
        case 'freemium':
          quotaUpdates = { plan_type: 'freemium', exports_limit: 0, clipboard_copies_limit: 10, favorites_limit: 10 }
          break
        case 'standard':
          quotaUpdates = { plan_type: 'standard', exports_limit: 100, clipboard_copies_limit: 100, favorites_limit: 100 }
          break
        case 'premium':
          quotaUpdates = { plan_type: 'premium', exports_limit: null, clipboard_copies_limit: null, favorites_limit: null }
          break
      }

      const { error: quotaError } = await supabaseClient
        .from('search_quotas')
        .update({ ...quotaUpdates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (quotaError) throw quotaError

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