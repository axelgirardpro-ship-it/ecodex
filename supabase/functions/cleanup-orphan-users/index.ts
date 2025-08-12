import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the request is from an authenticated supra admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the current user is a supra admin
    const { data: isSupraAdmin, error: roleError } = await supabase
      .rpc('is_supra_admin', { user_uuid: user.id });

    if (roleError || !isSupraAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Only supra admins can cleanup orphan users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting orphan users cleanup by supra admin:', user.id);

    // Find orphan users (exist in auth.users but not in public.users)
    const { data: orphanUsers, error: orphanError } = await supabase
      .from('audit_logs')
      .select('user_id, details')
      .eq('action', 'cleanup_orphan_auth_user')
      .order('created_at', { ascending: false });

    if (orphanError) {
      console.error('Error finding orphan users:', orphanError);
      return new Response(
        JSON.stringify({ error: 'Failed to find orphan users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deletedCount = 0;
    const deletedUsers = [];

    if (orphanUsers && orphanUsers.length > 0) {
      // Delete orphan users from auth.users
      for (const orphan of orphanUsers) {
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(orphan.user_id);
          
          if (deleteError) {
            console.error(`Failed to delete user ${orphan.user_id}:`, deleteError);
          } else {
            deletedCount++;
            deletedUsers.push({
              user_id: orphan.user_id,
              email: orphan.details?.email
            });
            console.log(`Deleted orphan user: ${orphan.details?.email} (${orphan.user_id})`);
          }
        } catch (error) {
          console.error(`Error deleting user ${orphan.user_id}:`, error);
        }
      }
    }

    // Log the cleanup completion
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'completed_orphan_cleanup',
        details: {
          deleted_count: deletedCount,
          deleted_users: deletedUsers,
          cleanup_date: new Date().toISOString()
        }
      });

    console.log(`Orphan cleanup completed. Deleted ${deletedCount} users.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Orphan cleanup completed. Deleted ${deletedCount} users.`,
        deleted_users: deletedUsers
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in cleanup orphan users function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});