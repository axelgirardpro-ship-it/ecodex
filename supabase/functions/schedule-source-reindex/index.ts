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
    console.log(`Calling refresh_ef_all_for_source for: ${source_name}`);
    const { error: refreshError } = await supabase.rpc("refresh_ef_all_for_source", {
      p_source: source_name
    });

    if (refreshError) {
      console.error("Error: refresh_ef_all_for_source failed:", refreshError);
      return new Response(JSON.stringify({ 
        error: `Failed to refresh projection: ${refreshError.message}`,
        details: refreshError 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    console.log("refresh_ef_all_for_source completed successfully");

    // 3. Supprimer tous les records de la projection Algolia pour réinitialisation complète
    // On utilise un DELETE massif au lieu de TRUNCATE (pas de permissions)
    console.log("Clearing algolia_source_assignments_projection table...");
    const { error: deleteError } = await supabase
      .from("algolia_source_assignments_projection")
      .delete()
      .gte("id_fe", "");  // Condition toujours vraie pour tout supprimer

    if (deleteError) {
      console.error("Warning: Failed to clear projection table:", deleteError);
      // Ne pas faire échouer la requête, continuer quand même
    } else {
      console.log("Projection table cleared successfully");
    }

    // 4. Remplir la projection avec tous les records de la source (avec pagination)
    let allRecords: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log(`Fetching records for source: ${source_name}`);

    while (hasMore) {
      const { data: projectionData, error: projectionError } = await supabase
        .from("emission_factors_all_search")
        .select('"ID_FE", "Source", assigned_workspace_ids')
        .eq("Source", source_name)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (projectionError) {
        console.error("Projection fetch error:", projectionError);
        return new Response(JSON.stringify({ 
          error: `Failed to fetch projection data: ${projectionError.message}`,
          details: projectionError 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (projectionData && projectionData.length > 0) {
        console.log(`Fetched page ${page}, records: ${projectionData.length}`);
        allRecords = allRecords.concat(projectionData);
        page++;
        hasMore = projectionData.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total records fetched: ${allRecords.length}`);

    if (allRecords.length > 0) {
      const recordsToInsert = allRecords.map((row: any) => ({
        id_fe: row.ID_FE || row["ID_FE"],
        source_name: row.Source || source_name,
        assigned_workspace_ids: row.assigned_workspace_ids || [],
        updated_at: new Date().toISOString()
      }));

      console.log(`Prepared ${recordsToInsert.length} records for insertion`);

      // Insérer par batches de 1000
      const batchSize = 1000;
      let insertedCount = 0;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from("algolia_source_assignments_projection")
          .insert(batch);

        if (insertError) {
          console.error(`Failed to insert batch ${i / batchSize + 1}:`, insertError);
        } else {
          insertedCount += batch.length;
          console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} records (total: ${insertedCount})`);
        }
      }
    } else {
      console.log("No records found for this source");
    }

    // 5. Déclencher la Task Algolia via API REST directe
    const taskId = "f3cd3fd0-2db4-49fa-be67-6bd88cbc5950";
    const ALGOLIA_APP_ID = Deno.env.get("ALGOLIA_APP_ID") || "";
    const ALGOLIA_ADMIN_KEY = Deno.env.get("ALGOLIA_ADMIN_KEY") || "";
    
    let taskTriggered = false;
    if (ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY) {
      try {
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
        
        if (taskResponse.ok) {
          taskTriggered = true;
          console.log("Algolia task triggered successfully");
        } else {
          const errorText = await taskResponse.text();
          console.error("Failed to trigger Algolia task:", errorText);
        }
      } catch (e) {
        console.error("Error triggering Algolia task:", String(e));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Source ${source_name} ${action === "assign" ? "assigned to" : "unassigned from"} workspace ${workspace_id}`,
      algolia_sync: taskTriggered ? "scheduled" : "failed",
      records_prepared: allRecords.length
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

