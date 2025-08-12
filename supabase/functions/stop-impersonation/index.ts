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

    const { originalUserId } = await req.json();

    if (!originalUserId) {
      throw new Error('Missing original user ID');
    }

    console.log(`Stopping impersonation, returning to original user ${originalUserId}`);

    // Get the original user's data from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(originalUserId);
    
    if (authError || !authUser.user) {
      throw new Error('Original user not found in auth system');
    }

    // Generate a new session for the original user
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email!,
      options: {
        redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/admin`
      }
    });

    if (tokenError || !tokenData) {
      throw new Error('Failed to generate session for original user');
    }

    // Log the end of impersonation
    await supabase
      .from('audit_logs')
      .insert({
        user_id: originalUserId,
        action: 'stop_impersonation',
        details: {
          original_user_id: originalUserId
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.properties?.access_token,
        refresh_token: tokenData.properties?.refresh_token,
        original_user: { id: originalUserId, email: authUser.user.email }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Stop impersonation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});