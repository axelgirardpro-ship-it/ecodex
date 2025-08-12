import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: 'admin' | 'gestionnaire' | 'lecteur';
  companyName?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-INVITATION] ${step}${detailsStr}`);
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

    // Authenticate the requester
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get request data
    const { email, role, companyName }: InvitationRequest = await req.json();
    logStep("Request data received", { email, role, companyName });

    // Get user's company and verify they can invite
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('company_id, role, companies(*)')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (rolesError || !userRoles) {
      throw new Error("You don't have permission to invite users");
    }

    const company = userRoles.companies;
    logStep("User company verified", { companyId: company.id, companyName: company.name });

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation record
    const { error: inviteError } = await supabaseClient
      .from('company_invitations')
      .insert({
        company_id: company.id,
        email,
        role,
        invited_by: user.id,
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      });

    if (inviteError) {
      if (inviteError.code === '23505') { // Unique constraint violation
        throw new Error("Cette personne a déjà été invitée dans cette entreprise");
      }
      throw new Error(`Error creating invitation: ${inviteError.message}`);
    }

    logStep("Invitation record created", { token: invitationToken, expiresAt });

    // Send email invitation using Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const inviteUrl = `${origin}/invite/${invitationToken}`;

    const roleNames = {
      admin: 'Administrateur',
      gestionnaire: 'Gestionnaire',
      lecteur: 'Lecteur'
    };

    const emailResult = await resend.emails.send({
      from: "EcoConsulting <noreply@resend.dev>",
      to: [email],
      subject: `Invitation à rejoindre ${company.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">Invitation à rejoindre une équipe</h1>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Bonjour,</p>
            <p>Vous avez été invité(e) à rejoindre l'équipe <strong>${company.name}</strong> en tant que <strong>${roleNames[role]}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accepter l'invitation
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Cette invitation expire le ${expiresAt.toLocaleDateString('fr-FR')}.<br>
              Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.
            </p>
          </div>
          
          <p style="text-align: center; font-size: 12px; color: #9ca3af;">
            EcoConsulting - Plateforme d'analyse carbone
          </p>
        </div>
      `,
    });

    logStep("Email sent", { emailId: emailResult.data?.id });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invitation envoyée avec succès",
      inviteUrl: inviteUrl 
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