import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the request is from an authenticated supra admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the current user is a supra admin using the new structure
    const { data: isSupraAdmin, error: roleError } = await supabaseAdmin
      .rpc('is_supra_admin', { user_uuid: user.id });

    if (roleError || !isSupraAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Only supra admins can create other supra admins.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password strength
    if (password.length < 12) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 12 characters long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers.users.some(u => u.email === email)

    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    try {
      console.log('Creating supra admin user with email:', email)
      
      // Create the user with special metadata to bypass normal user setup
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          created_by_supra_admin: true 
        },
        app_metadata: { 
          created_by_supra_admin: true 
        }
      })
      
      console.log('User creation result:', { 
        success: !!newUser.user, 
        userId: newUser.user?.id,
        error: createError?.message
      })

      if (createError || !newUser.user) {
        console.error('Detailed error:', createError)
        throw new Error(`Failed to create user: ${createError?.message || 'Unknown error'}`)
      }

      // Get or create a Global Administration workspace
      let globalWorkspaceId;
      const { data: globalWorkspace, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('name', 'Global Administration')
        .single();

      if (workspaceError || !globalWorkspace) {
        // Create Global Administration workspace if it doesn't exist
        const { data: newWorkspace, error: createWorkspaceError } = await supabaseAdmin
          .from('workspaces')
          .insert({
            name: 'Global Administration',
            owner_id: newUser.user.id,
            plan_type: 'premium'
          })
          .select('id')
          .single();

        if (createWorkspaceError || !newWorkspace) {
          throw new Error(`Failed to create Global Administration workspace: ${createWorkspaceError?.message}`);
        }
        globalWorkspaceId = newWorkspace.id;
      } else {
        globalWorkspaceId = globalWorkspace.id;
      }

      // Create user record
      const { error: userRecordError } = await supabaseAdmin
        .from('users')
        .insert({
          user_id: newUser.user.id,
          workspace_id: globalWorkspaceId,
          email: email,
          plan_type: 'premium',
          subscribed: true,
          assigned_by: user.id
        });

      if (userRecordError) {
        throw new Error(`Failed to create user record: ${userRecordError.message}`);
      }

      // Assign admin role with supra_admin flag
      const { error: roleAssignError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'admin',
          workspace_id: globalWorkspaceId,
          assigned_by: user.id,
          is_supra_admin: true
        });

      console.log('Role assignment result:', { success: !roleAssignError, error: roleAssignError?.message })

      if (roleAssignError) {
        console.error('Role assignment failed:', roleAssignError)
        throw new Error(`Failed to assign role: ${roleAssignError.message}`)
      }

      // Log the admin creation for audit purposes
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'create_supra_admin',
          details: {
            created_admin_email: email,
            created_admin_id: newUser.user.id
          }
        })

      console.log('Supra admin created successfully')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Supra admin account created successfully for ${email}`,
          user_id: newUser.user.id 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (createUserError) {
      console.error('Error in user creation process:', createUserError)
      return new Response(
        JSON.stringify({ error: createUserError.message || 'Failed to create supra admin' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error creating supra admin:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})