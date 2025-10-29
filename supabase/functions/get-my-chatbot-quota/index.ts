import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's quotas from search_quotas (consolidated table)
    const { data: quotas } = await supabaseAdmin
      .from('search_quotas')
      .select('chatbot_queries_used, chatbot_queries_limit, chatbot_reset_date')
      .eq('user_id', user.id)
      .single();

    if (!quotas) {
      return new Response(JSON.stringify({ 
        error: 'Quota data not found'
      }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const used = quotas.chatbot_queries_used || 0;
    const limit = quotas.chatbot_queries_limit || 3;
    const plan = limit === 50 ? 'pro' : 'freemium';

    return new Response(JSON.stringify({
      used,
      limit,
      plan,
      resetDate: quotas.chatbot_reset_date || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


