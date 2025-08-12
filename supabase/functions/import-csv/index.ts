import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is supra admin
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is supra admin using the correct table and function
    const { data: supaAdminCheck, error: roleError } = await supabase
      .rpc('is_supra_admin', { user_uuid: user.id })

    if (roleError || !supaAdminCheck) {
      return new Response(JSON.stringify({ error: 'Access denied - supra admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const replaceExisting = formData.get('replaceExisting') === 'true'

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('data_imports')
      .insert({
        imported_by: user.id,
        file_name: file.name,
        file_size: file.size,
        status: 'processing'
      })
      .select()
      .single()

    if (importError) {
      console.error('Error creating import record:', importError)
      return new Response(JSON.stringify({ error: 'Failed to create import record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    try {
      const csvText = await file.text()
      const lines = csvText.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      let recordsProcessed = 0
      let recordsInserted = 0
      let recordsUpdated = 0
      let recordsFailed = 0
      const errors: string[] = []

      // If replacing existing, delete all current emission factors
      if (replaceExisting) {
        await supabase.from('emission_factors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      }

      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        
        if (values.length !== headers.length) {
          recordsFailed++
          errors.push(`Line ${i + 1}: Column count mismatch`)
          continue
        }

        recordsProcessed++

        const record: any = {}
        headers.forEach((header, index) => {
          const value = values[index]
          
          // Map CSV headers to database columns
          switch (header.toLowerCase()) {
            case 'nom':
            case 'name':
              record.nom = value
              break
            case 'description':
              record.description = value || null
              break
            case 'fe':
            case 'emission_factor':
            case 'factor':
              record.fe = parseFloat(value) || 0
              break
            case 'unite':
            case 'unit':
              record.unite = value
              break
            case 'secteur':
            case 'sector':
              record.secteur = value
              break
            case 'categorie':
            case 'category':
              record.categorie = value
              break
            case 'source':
              record.source = value
              break
            case 'localisation':
            case 'location':
              record.localisation = value
              break
            case 'date':
            case 'year':
              record.date = value
              break
            case 'incertitude':
            case 'uncertainty':
              record.incertitude = value || null
              break
            case 'plan_tier':
            case 'tier':
              record.plan_tier = value || 'standard'
              break
            case 'is_public':
            case 'public':
              record.is_public = value.toLowerCase() === 'true' || value === '1'
              break
          }
        })

        // Validate required fields
        if (!record.nom || !record.fe || !record.unite || !record.secteur || !record.categorie || !record.source || !record.localisation || !record.date) {
          recordsFailed++
          errors.push(`Line ${i + 1}: Missing required fields`)
          continue
        }

        // Set default values
        record.is_public = record.is_public ?? true
        record.plan_tier = record.plan_tier || 'standard'

        // Insert record
        const { error: insertError } = await supabase
          .from('emission_factors')
          .insert(record)

        if (insertError) {
          recordsFailed++
          errors.push(`Line ${i + 1}: ${insertError.message}`)
        } else {
          recordsInserted++
        }
      }

      // Update import record with results
      await supabase
        .from('data_imports')
        .update({
          records_processed: recordsProcessed,
          records_inserted: recordsInserted,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
          status: recordsFailed > 0 ? 'completed_with_errors' : 'completed',
          error_details: errors.length > 0 ? { errors } : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', importRecord.id)

      return new Response(JSON.stringify({
        success: true,
        importId: importRecord.id,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errors: errors.slice(0, 10) // Return first 10 errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      // Update import record with error
      await supabase
        .from('data_imports')
        .update({
          status: 'failed',
          error_details: { error: error.message },
          completed_at: new Date().toISOString()
        })
        .eq('id', importRecord.id)

      throw error
    }

  } catch (error) {
    console.error('Import error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})