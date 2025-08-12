import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  type: 'workspace' | 'user';
  id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { type, id }: DeleteRequest = await req.json();
    console.log(`DeleteEntities: Starting deletion of ${type} with id: ${id}`);

    if (type === 'workspace') {
      // Delete workspace and all its dependencies
      console.log(`DeleteEntities: Deleting workspace ${id}`);

      // Get all users in this workspace first
      const { data: workspaceUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('user_id')
        .eq('workspace_id', id);

      if (usersError) {
        console.error('Error fetching workspace users:', usersError);
        throw usersError;
      }

      const userIds = workspaceUsers?.map(u => u.user_id) || [];
      console.log(`DeleteEntities: Found ${userIds.length} users in workspace`);

      // Delete all dependent data for these users
      for (const userId of userIds) {
        // Delete search quotas
        await supabaseAdmin.from('search_quotas').delete().eq('user_id', userId);
        
        // Delete favorites
        await supabaseAdmin.from('favorites').delete().eq('user_id', userId);
        
        // Delete search history
        await supabaseAdmin.from('search_history').delete().eq('user_id', userId);
        
        // Delete user sessions
        await supabaseAdmin.from('user_sessions').delete().eq('user_id', userId);
        
        // Delete audit logs
        await supabaseAdmin.from('audit_logs').delete().eq('user_id', userId);
        
        console.log(`DeleteEntities: Deleted dependent data for user ${userId}`);
      }

      // Delete workspace-specific data
      await supabaseAdmin.from('user_roles').delete().eq('workspace_id', id);
      await supabaseAdmin.from('workspace_invitations').delete().eq('workspace_id', id);
      await supabaseAdmin.from('datasets').delete().eq('workspace_id', id);
      await supabaseAdmin.from('fe_source_workspace_assignments').delete().eq('workspace_id', id);
      await supabaseAdmin.from('emission_factors').delete().eq('workspace_id', id);
      
      // Delete users from public.users table
      await supabaseAdmin.from('users').delete().eq('workspace_id', id);
      
      // Delete workspace
      const { error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .delete()
        .eq('id', id);

      if (workspaceError) {
        console.error('Error deleting workspace:', workspaceError);
        throw workspaceError;
      }

      // Delete users from auth.users (except workspace owner to avoid cascade issues)
      const { data: workspace } = await supabaseAdmin
        .from('workspaces')
        .select('owner_id')
        .eq('id', id)
        .single();

      for (const userId of userIds) {
        if (workspace && userId !== workspace.owner_id) {
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (authError) {
            console.log(`Warning: Could not delete auth user ${userId}:`, authError.message);
          }
        }
      }

      console.log(`DeleteEntities: Successfully deleted workspace ${id}`);

    } else if (type === 'user') {
      // Delete user and all their dependencies
      console.log(`DeleteEntities: Deleting user ${id}`);

      // Delete user's dependent data
      await supabaseAdmin.from('search_quotas').delete().eq('user_id', id);
      await supabaseAdmin.from('favorites').delete().eq('user_id', id);
      await supabaseAdmin.from('search_history').delete().eq('user_id', id);
      await supabaseAdmin.from('user_sessions').delete().eq('user_id', id);
      await supabaseAdmin.from('audit_logs').delete().eq('user_id', id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', id);
      
      // Delete from public.users
      await supabaseAdmin.from('users').delete().eq('user_id', id);
      
      // Delete from auth.users
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authError) {
        console.log(`Warning: Could not delete auth user ${id}:`, authError.message);
      }

      console.log(`DeleteEntities: Successfully deleted user ${id}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `${type} deleted successfully` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('DeleteEntities error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred during deletion',
        details: error 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});