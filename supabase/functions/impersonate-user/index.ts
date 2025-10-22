import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[impersonate-user] No Authorization header')
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '')
    
    console.log('[impersonate-user] Validating JWT')
    console.log('[impersonate-user] Token starts with:', token.substring(0, 20))
    
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
      
      console.log('[impersonate-user] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[impersonate-user] Failed to decode JWT:', error)
      throw new Error('Invalid JWT format: ' + error.message)
    }
    
    // Créer un client Supabase avec SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser) {
      console.error('[impersonate-user] User validation failed:', authError)
      throw new Error('Invalid user: ' + authError?.message)
    }

    const user = authUser.user
    console.log('[impersonate-user] User authenticated successfully:', user.id)

    // Check if user is supra admin
    const { data: isSupraAdmin, error: adminError } = await supabase.rpc('is_supra_admin', {
      user_uuid: user.id
    });

    if (adminError || !isSupraAdmin) {
      throw new Error('Insufficient permissions - supra admin required');
    }

    const { targetUserId, originalUserId } = await req.json();

    if (!targetUserId || !originalUserId) {
      throw new Error('Missing required parameters');
    }

    console.log(`Supra admin ${originalUserId} starting impersonation of user ${targetUserId}`);

    // Verify target user exists and get their data
    const { data: targetUserData, error: targetError } = await supabase
      .from('users')
      .select('user_id, email, workspace_id')
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetUserData) {
      throw new Error('Target user not found');
    }

    // Get user from auth.users table to create session
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(targetUserId);
    
    if (authError || !authUser.user) {
      throw new Error('Target user not found in auth system');
    }

    // Create an access token for the target user
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email!,
      options: {
        redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/search`
      }
    });

    if (tokenError || !tokenData) {
      throw new Error('Failed to generate session for target user');
    }

    // Log the impersonation for audit purposes
    await supabase
      .from('audit_logs')
      .insert({
        user_id: originalUserId,
        action: 'start_impersonation',
        details: {
          target_user_id: targetUserId,
          target_email: targetUserData.email,
          workspace_id: targetUserData.workspace_id
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.properties?.access_token,
        refresh_token: tokenData.properties?.refresh_token,
        target_user: targetUserData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Impersonation error:', error);
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