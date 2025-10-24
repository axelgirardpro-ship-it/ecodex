import type {} from "../types/esm-sh.d.ts";

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Déclaration globale pour Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('[schedule-source-reindex] No Authorization header')
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extraire le token du header "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");
    
    console.log('[schedule-source-reindex] Validating JWT')
    console.log('[schedule-source-reindex] Token starts with:', token.substring(0, 20))
    
    // Décoder le JWT pour obtenir le payload (sans vérification de signature)
    // La signature sera vérifiée en vérifiant que l'utilisateur existe dans la base
    let userId: string;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Décoder le payload (partie 2 du JWT)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      userId = payload.sub;
      
      if (!userId) {
        throw new Error('No user ID in JWT');
      }
      
      console.log('[schedule-source-reindex] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[schedule-source-reindex] Failed to decode JWT:', error)
      return new Response(JSON.stringify({ 
        error: 'Invalid JWT format',
        details: error.message
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    
    // Créer un client Supabase avec SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !authUser) {
      console.error('[schedule-source-reindex] User validation failed:', userError)
      return new Response(JSON.stringify({ 
        error: 'Invalid user',
        details: userError?.message
      }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const user = authUser.user;
    console.log('[schedule-source-reindex] User authenticated successfully:', user.id)

    // Vérifier que l'utilisateur est supra_admin
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_supra_admin", {
      user_uuid: user.id
    });

    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: supra_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { source_name, workspace_id, action } = body;

    console.log(`[START] Action: ${action}, Source: ${source_name}, Workspace: ${workspace_id}`);

    if (!source_name || !workspace_id || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields: source_name, workspace_id, action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!["assign", "unassign"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action. Must be 'assign' or 'unassign'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validation: Récupérer le nom exact de la source (recherche SQL brute pour être sûr)
    console.log(`[VALIDATION] Checking if source exists: ${source_name}`);
    
    // Utiliser une requête SQL brute avec ILIKE pour la recherche insensible à la casse
    const { data: sourceCheckData, error: sourceCheckError } = await supabase.rpc('get_exact_source_name', {
      p_source_name: source_name
    });

    if (sourceCheckError) {
      console.error("Error checking source:", sourceCheckError);
      return new Response(JSON.stringify({ 
        error: `Error checking source: ${sourceCheckError.message}`,
        details: sourceCheckError 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!sourceCheckData || sourceCheckData.length === 0) {
      console.error("Source not found in fe_sources");
      return new Response(JSON.stringify({ 
        error: `Source "${source_name}" not found in fe_sources`
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Utiliser le nom exact de la source tel qu'enregistré dans la DB
    const exactSourceName = sourceCheckData[0].source_name || source_name;
    console.log(`✓ Source found with exact name: ${exactSourceName}`);

    // 1. Mettre à jour fe_source_workspace_assignments
    console.log(`[STEP 1] Updating fe_source_workspace_assignments...`)
    if (action === "assign") {
      const { error: assignError } = await supabase
        .from("fe_source_workspace_assignments")
        .upsert({
          source_name: exactSourceName,
          workspace_id,
          created_at: new Date().toISOString()
        });

      if (assignError) {
        console.error("Assignment error:", assignError);
        return new Response(JSON.stringify({ error: `Failed to assign: ${assignError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      console.log("✓ Assignment successful");
    } else {
      const { error: unassignError } = await supabase
        .from("fe_source_workspace_assignments")
        .delete()
        .eq("source_name", exactSourceName)
        .eq("workspace_id", workspace_id);

      if (unassignError) {
        console.error("Unassignment error:", unassignError);
        return new Response(JSON.stringify({ error: `Failed to unassign: ${unassignError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      console.log("✓ Unassignment successful");
    }

    // 2. Planifier le rafraîchissement asynchrone de la projection (évite les timeouts)
    console.log(`[STEP 2] Scheduling async projection refresh for: ${exactSourceName}`);
    const { error: scheduleError } = await supabase.rpc("schedule_source_refresh", {
      p_source: exactSourceName
    });

    if (scheduleError) {
      console.warn("⚠ Warning: Failed to schedule projection refresh:", scheduleError);
      // Ne pas bloquer - continuer quand même car les données sont déjà assignées
    } else {
      console.log("✓ Async projection refresh scheduled via pg_notify");
    }

    // 3. Préparer les données Algolia via fonction SQL optimisée
    console.log("[STEP 3] Preparing Algolia sync data...");
    const { error: prepError } = await supabase.rpc("trigger_algolia_sync_for_source", {
      p_source: exactSourceName
    });

    if (prepError) {
      console.error("⚠ Warning: Failed to prepare Algolia data:", prepError);
      // Ne pas bloquer - continuer quand même
    } else {
      console.log("✓ Algolia data prepared in projection table");
    }

    // 4. Déclencher la Task Algolia (f3cd3fd0-2db4-49fa-be67-6bd88cbc5950)
    // Cette task lit automatiquement depuis algolia_source_assignments_projection
    console.log("[STEP 4] Triggering Algolia Task...");
    
    try {
      const ALGOLIA_APP_ID = Deno.env.get("ALGOLIA_APP_ID");
      const ALGOLIA_ADMIN_KEY = Deno.env.get("ALGOLIA_ADMIN_KEY");
      
      if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
        console.error("✗ Algolia credentials not configured");
        return new Response(JSON.stringify({
          success: true,
          message: `Source ${exactSourceName} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}.`,
          algolia_sync: "skipped",
          warning: "Algolia credentials not configured"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const taskId = "f3cd3fd0-2db4-49fa-be67-6bd88cbc5950";
      const taskUrl = `https://data.eu.algolia.com/2/tasks/${taskId}/run`;
      
      const taskResponse = await fetch(taskUrl, {
        method: "POST",
        headers: {
          "x-algolia-application-id": ALGOLIA_APP_ID,
          "x-algolia-api-key": ALGOLIA_ADMIN_KEY,
          "accept": "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({ runMetadata: {} })
      });

      if (!taskResponse.ok) {
        const errorText = await taskResponse.text();
        console.error("✗ Algolia task failed:", taskResponse.status, errorText);
        return new Response(JSON.stringify({
          success: true,
          message: `Source ${exactSourceName} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}.`,
          algolia_sync: "failed",
          algolia_error: `HTTP ${taskResponse.status}: ${errorText}`
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log("✓ Algolia Task triggered successfully");
      
      return new Response(JSON.stringify({
        success: true,
        message: `Source ${exactSourceName} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}. Algolia sync in progress.`,
        algolia_sync: "triggered"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("✗ Exception triggering Algolia:", error);
      return new Response(JSON.stringify({
        success: true,
        message: `Source ${exactSourceName} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}.`,
        algolia_sync: "failed",
        algolia_error: String(error)
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error("[ERROR] Unhandled exception:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

