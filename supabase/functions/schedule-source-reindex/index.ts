import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    // 1. Mettre à jour fe_source_workspace_assignments
    if (action === "assign") {
      const { error: assignError } = await supabase
        .from("fe_source_workspace_assignments")
        .upsert({
          source_name,
          workspace_id,
          created_at: new Date().toISOString()
        });

      if (assignError) {
        return new Response(JSON.stringify({ error: `Failed to assign: ${assignError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else {
      const { error: unassignError } = await supabase
        .from("fe_source_workspace_assignments")
        .delete()
        .eq("source_name", source_name)
        .eq("workspace_id", workspace_id);

      if (unassignError) {
        return new Response(JSON.stringify({ error: `Failed to unassign: ${unassignError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Rafraîchir la projection principale
    const { error: refreshError } = await supabase.rpc("refresh_ef_all_for_source", {
      p_source: source_name
    });

    if (refreshError) {
      console.error("Warning: refresh_ef_all_for_source failed:", refreshError);
    }

    // 3. TRUNCATE la table de projection Algolia (en utilisant DELETE pour contourner les permissions)
    const { error: truncateError } = await supabase
      .from("algolia_source_assignments_projection")
      .delete()
      .neq("id_fe", "impossible-uuid-to-match-all");

    if (truncateError) {
      console.error("Warning: Failed to clear projection table:", truncateError);
    }

    // 4. Remplir la projection avec tous les records de la source
    const { data: projectionData, error: projectionError } = await supabase
      .from("emission_factors_all_search")
      .select("ID_FE, Source, assigned_workspace_ids")
      .eq("Source", source_name);

    if (projectionError) {
      return new Response(JSON.stringify({ error: `Failed to fetch projection data: ${projectionError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (projectionData && projectionData.length > 0) {
      const recordsToInsert = projectionData.map((row: any) => ({
        id_fe: row.ID_FE,
        source_name: row.Source,
        assigned_workspace_ids: row.assigned_workspace_ids || [],
        updated_at: new Date().toISOString()
      }));

      // Insérer par batches de 1000
      const batchSize = 1000;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("algolia_source_assignments_projection")
          .insert(batch);

        if (insertError) {
          console.error(`Failed to insert batch ${i / batchSize + 1}:`, insertError);
        }
      }
    }

    // 5. Déclencher la Task Algolia
    const taskId = "cc1759c5-1e16-4ad5-a43d-7f12bac903ad";
    const { data: taskData, error: taskError } = await supabase.functions.invoke("algolia-run-task", {
      body: { task_id: taskId, region: "eu" }
    });

    if (taskError) {
      console.error("Warning: Failed to trigger Algolia task:", taskError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Source ${source_name} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}`,
      algolia_sync: taskError ? "failed" : "scheduled",
      records_prepared: projectionData?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

