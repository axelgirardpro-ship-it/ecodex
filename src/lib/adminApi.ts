import { supabase } from '@/integrations/supabase/client'
import type { PlanTier, TierLimitCheck } from '@/types/plan-tiers'

// Cache mémoire simple pour éviter les appels redondants vers get-admin-workspaces
type WorkspacesCacheEntry = { data:Record<string, unknown>[]; expiresAt: number; inflight?: Promise<any[]> }
const WORKSPACES_CACHE_TTL_MS = 60_000
const workspacesCache: Record<string, WorkspacesCacheEntry> = {}

export function invalidateAdminWorkspacesCache() {
  Object.keys(workspacesCache).forEach(k=> delete workspacesCache[k])
}

/**
 * Fonction utilitaire pour invoquer une Edge Function avec authentification
 * Gère automatiquement le refresh de session si nécessaire
 * @param fn Nom de la fonction Edge à invoquer
 * @param options Options (body, headers)
 * @returns Promise avec data et error
 */
export async function invokeWithAuth<T = any>(fn: string, options?: {
  body?: any,
  headers?: Record<string, string>,
}): Promise<{ data: T | null; error: unknown | null }> {
  // Tenter de récupérer la session, et forcer un refresh si nécessaire
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  // Debug: Log session status
  console.log(`[invokeWithAuth] Appel Edge Function: ${fn}`);
  console.log(`[invokeWithAuth] Session présente:`, !!sessionData?.session);
  console.log(`[invokeWithAuth] Token présent:`, !!sessionData?.session?.access_token);
  
  // Si pas de session ou erreur, tenter de rafraîchir
  if (!sessionData?.session || sessionError) {
    console.warn('[invokeWithAuth] Session invalide ou absente, tentative de rafraîchissement...');
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshedData?.session) {
      console.error('[invokeWithAuth] Impossible de rafraîchir la session:', refreshError);
      return { 
        data: null, 
        error: new Error('Session expirée ou invalide. Veuillez vous reconnecter.') 
      };
    }
    
    console.log('[invokeWithAuth] Session rafraîchie avec succès');
    sessionData = refreshedData;
  }
  
  const accessToken = sessionData?.session?.access_token;
  
  if (!accessToken) {
    console.error('[invokeWithAuth] Pas de token d\'accès disponible');
    return { 
      data: null, 
      error: new Error('Token d\'accès manquant. Veuillez vous reconnecter.') 
    };
  }
  
  // IMPORTANT: supabase.functions.invoke() N'ajoute PAS automatiquement Authorization
  // Il FAUT l'ajouter explicitement dans les headers
  const headers = {
    ...(options?.headers || {}),
    'Authorization': `Bearer ${accessToken}`,
  } as Record<string, string>;
  
  console.log(`[invokeWithAuth] Appel de l'Edge Function "${fn}"...`);
  console.log(`[invokeWithAuth] Access token (premiers 20 chars):`, accessToken.substring(0, 20));
  
  const { data, error } = await supabase.functions.invoke(fn, {
    body: options?.body,
    headers,
  });
  
  // Si on reçoit une erreur 401, c'est probablement que le token est invalide
  if (error) {
    console.error(`[invokeWithAuth] Erreur lors de l'appel à ${fn}:`, error);
    
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Invalid JWT')) {
      console.warn('[invokeWithAuth] Erreur 401/JWT reçue, session probablement expirée');
      return { 
        data: null, 
        error: new Error('Session expirée. Veuillez rafraîchir la page et vous reconnecter si nécessaire.') 
      };
    }
  } else {
    console.log(`[invokeWithAuth] Appel à ${fn} réussi`);
  }
  
  return { data, error };
}

export type PlanFilter = 'all' | 'paid' | 'freemium'

export async function getAdminWorkspaces(planFilter: PlanFilter, opts?: { force?: boolean }) {
  const key = `v1:${planFilter}`
  const now = Date.now()
  const cached = workspacesCache[key]
  // Retour immédiat si encore valide
  if (!opts?.force && cached && now < cached.expiresAt && Array.isArray(cached.data)) {
    return cached.data
  }
  // Dédoublonnage des requêtes concurrentes
  if (!opts?.force && cached?.inflight) return cached.inflight
  const inflight = (async () => {
    const { data, error } = await invokeWithAuth('get-admin-workspaces', { body: { planFilter } })
    if (error) throw error
    const value = (data?.data ?? []) as any[]
    workspacesCache[key] = { data: value, expiresAt: now + WORKSPACES_CACHE_TTL_MS }
    return value
  })()
  workspacesCache[key] = { data: cached?.data ?? [], expiresAt: 0, inflight }
  return inflight
}

export async function getAdminContacts(workspaceId: string | 'all', page = 1, pageSize = 25) {
  const { data, error } = await invokeWithAuth('get-admin-contacts', {
    body: { workspaceId, page, pageSize }
  })
  if (error) throw error
  return { items: data?.data ?? [], total: data?.total ?? 0 }
}

export async function updateWorkspacePlan(workspaceId: string, newPlan: 'freemium'|'pro') {
  const { data, error } = await invokeWithAuth('update-user-plan-role', {
    body: { action: 'update_workspace_plan', workspaceId, newPlan }
  })
  if (error) throw error
  // Invalidation du cache des workspaces
  invalidateAdminWorkspacesCache()
  return data
}

// ============================================================================
// GESTION DES TIERS DE PLANS
// ============================================================================

export async function getPlanTiers(): Promise<PlanTier[]> {
  const { data, error } = await supabase
    .from('plan_tiers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function updateWorkspaceTier(workspaceId: string, tierCode: string) {
  const { data, error } = await invokeWithAuth('update-user-plan-role', {
    body: { action: 'update_workspace_tier', workspaceId, tierCode }
  })
  if (error) {
    // Formater l'erreur pour un meilleur affichage
    if (error.message?.includes('user limit exceeded')) {
      const errorData = typeof error === 'object' && 'message' in error ? error : { message: error }
      throw new Error(errorData.message)
    }
    throw error
  }
  // Invalidation du cache des workspaces
  invalidateAdminWorkspacesCache()
  return data
}

export async function getWorkspaceTierLimits(workspaceId: string): Promise<TierLimitCheck> {
  const { data, error } = await supabase
    .rpc('check_workspace_user_limit', { p_workspace_id: workspaceId })
  
  if (error) throw error
  return data as TierLimitCheck
}

export async function updateUserRole(userId: string, workspaceId: string, newRole: 'admin'|'gestionnaire'|'lecteur') {
  const { data, error } = await supabase.functions.invoke('update-user-plan-role', {
    body: { action: 'update_user_role', userId, workspaceId, newRole }
  })
  if (error) throw error
  return data
}

export async function deleteWorkspace(workspaceId: string) {
  const { error } = await invokeWithAuth('delete-admin-entities', {
    body: { type: 'workspace', id: workspaceId }
  })
  if (error) throw error
  // Invalidation du cache des workspaces
  invalidateAdminWorkspacesCache()
}

export async function deleteUser(userId: string) {
  const { error } = await invokeWithAuth('delete-admin-entities', {
    body: { type: 'user', id: userId }
  })
  if (error) throw error
}

export async function assignFeSourceToWorkspace(sourceName: string, workspaceId: string) {
  const { data, error } = await invokeWithAuth('schedule-source-reindex', {
    body: { action: 'assign', source_name: sourceName, workspace_id: workspaceId }
  })
  if (error) throw error
  return data
}

export async function unassignFeSourceFromWorkspace(sourceName: string, workspaceId: string) {
  const { data, error } = await invokeWithAuth('schedule-source-reindex', {
    body: { action: 'unassign', source_name: sourceName, workspace_id: workspaceId }
  })
  if (error) throw error
  return data
}

export async function syncWorkspaceAssignments(workspaceId: string, assigned: string[], unassigned: string[]) {
  // Utilise le nouveau flux schedule-source-reindex pour chaque source
  const results = {
    assigned_count: 0,
    unassigned_count: 0,
    errors: [] as string[]
  }

  // Traiter les assignations
  for (const sourceName of assigned) {
    try {
      await assignFeSourceToWorkspace(sourceName, workspaceId)
      results.assigned_count++
    } catch (error) {
      results.errors.push(`Failed to assign ${sourceName}: ${error}`)
    }
  }

  // Traiter les désassignations
  for (const sourceName of unassigned) {
    try {
      await unassignFeSourceFromWorkspace(sourceName, workspaceId)
      results.unassigned_count++
    } catch (error) {
      results.errors.push(`Failed to unassign ${sourceName}: ${error}`)
    }
  }

  if (results.errors.length > 0) {
    console.warn('Some operations failed:', results.errors)
  }

  return results
}

// ============================================================================
// GESTION DES UTILISATEURS DU WORKSPACE
// ============================================================================

export interface WorkspaceUser {
  user_id: string
  first_name: string | null
  last_name: string | null
  email: string
  created_at: string
  user_roles: {
    role: 'admin' | 'gestionnaire'
    created_at: string
  }[]
}

export interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'gestionnaire'
  created_at: string
  expires_at: string
}

export interface WorkspaceUsersResponse {
  users: WorkspaceUser[]
  pendingInvitations: PendingInvitation[]
}

export async function getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUsersResponse> {
  const { data, error } = await invokeWithAuth('manage-workspace-users', {
    body: { action: 'get_users', workspaceId }
  })
  if (error) throw error
  return data
}

export async function inviteUserToWorkspace(
  workspaceId: string, 
  email: string, 
  role: 'admin' | 'gestionnaire'
) {
  const { data, error } = await invokeWithAuth('manage-workspace-users', {
    body: { action: 'invite_user', workspaceId, email, role }
  })
  if (error) throw error
  return data
}

export async function updateUserRoleInWorkspace(
  workspaceId: string,
  userId: string,
  newRole: 'admin' | 'gestionnaire'
) {
  const { data, error } = await invokeWithAuth('manage-workspace-users', {
    body: { action: 'update_role', workspaceId, userId, newRole }
  })
  if (error) throw error
  return data
}

export async function removeUserFromWorkspace(workspaceId: string, userId: string) {
  const { data, error } = await invokeWithAuth('manage-workspace-users', {
    body: { action: 'remove_user', workspaceId, userId }
  })
  if (error) throw error
  return data
}

export async function resendWorkspaceInvitation(workspaceId: string, invitationId: string) {
  const { data, error } = await invokeWithAuth('manage-workspace-users', {
    body: { action: 'resend_invitation', workspaceId, invitationId }
  })
  if (error) throw error
  return data
}

// ============================================================================
// TRAITEMENT DES INVITATIONS
// ============================================================================

export interface InvitationDetails {
  email: string
  role: string
  workspace_name: string
  expires_at: string
}

export async function validateInvitationToken(token: string): Promise<InvitationDetails> {
  const { data, error } = await invokeWithAuth('process-invitation', {
    body: { action: 'validate', token }
  })
  if (error) throw error
  return data.invitation
}

export async function acceptInvitation(
  token: string,
  userMetadata?: {
    first_name?: string
    last_name?: string
    company?: string
  }
) {
  const { data, error } = await invokeWithAuth('process-invitation', {
    body: { action: 'accept', token, userMetadata }
  })
  if (error) throw error
  return data
}

export async function declineInvitation(token: string) {
  const { data, error } = await invokeWithAuth('process-invitation', {
    body: { action: 'decline', token }
  })
  if (error) throw error
  return data
}


