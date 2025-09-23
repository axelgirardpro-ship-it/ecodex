// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the calling user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { email, workspaceId, role, redirectTo } = await req.json();

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

    // Send invitation using admin API
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
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
      console.error('Supabase invitation error:', error);
      throw error;
    }

    console.log('Invitation sent successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation envoyée à ${email}`,
        data: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Invitation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erreur lors de l\'envoi de l\'invitation',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
