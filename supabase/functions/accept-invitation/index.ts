import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  token: string;
  userData?: {
    firstName: string;
    lastName: string;
    password: string;
  };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACCEPT-INVITATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase with service role for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { token, userData }: AcceptInvitationRequest = await req.json();
    logStep("Request data received", { token, hasUserData: !!userData });

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('company_invitations')
      .select(`
        *,
        companies (
          id,
          name,
          owner_id
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new Error("Invitation non trouvée ou expirée");
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Cette invitation a expiré");
    }

    logStep("Invitation found", { 
      invitationId: invitation.id, 
      email: invitation.email,
      companyName: invitation.companies.name 
    });

    let userId: string;

    // Check if user already exists
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === invitation.email);

    if (existingUser) {
      // User exists, just add them to the company
      userId = existingUser.id;
      logStep("Existing user found", { userId });
    } else {
      // Create new user if userData provided
      if (!userData) {
        throw new Error("User data required for new account creation");
      }

      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: invitation.email,
        password: userData.password,
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          company: invitation.companies.name
        }
      });

      if (createError || !newUser.user) {
        throw new Error(`Error creating user: ${createError?.message}`);
      }

      userId = newUser.user.id;
      logStep("New user created", { userId });
    }

    // Add user to company with specified role
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: userId,
        company_id: invitation.company_id,
        role: invitation.role,
        assigned_by: invitation.invited_by
      });

    if (roleError) {
      // If user already has a role in this company, update it
      if (roleError.code === '23505') {
        const { error: updateError } = await supabaseClient
          .from('user_roles')
          .update({ role: invitation.role, assigned_by: invitation.invited_by })
          .eq('user_id', userId)
          .eq('company_id', invitation.company_id);

        if (updateError) {
          throw new Error(`Error updating user role: ${updateError.message}`);
        }
      } else {
        throw new Error(`Error assigning role: ${roleError.message}`);
      }
    }

    logStep("User role assigned", { userId, role: invitation.role });

    // Mark invitation as accepted
    const { error: updateInviteError } = await supabaseClient
      .from('company_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateInviteError) {
      logStep("Warning: Could not mark invitation as accepted", { error: updateInviteError.message });
    }

    // Profile data is now automatically handled by handle_new_user trigger
    // No need to manually create profile anymore

    return new Response(JSON.stringify({ 
      success: true,
      message: "Invitation acceptée avec succès",
      companyName: invitation.companies.name,
      role: invitation.role,
      isNewUser: !existingUser
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});