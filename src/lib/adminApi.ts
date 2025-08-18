import { supabase } from '@/integrations/supabase/client'

export type PlanFilter = 'all' | 'paid' | 'freemium'

export async function getAdminWorkspaces(planFilter: PlanFilter) {
  const { data, error } = await supabase.functions.invoke('get-admin-workspaces', {
    body: { planFilter }
  })
  if (error) throw error
  return data?.data ?? []
}

export async function getAdminContacts(workspaceId: string | 'all', page = 1, pageSize = 25) {
  const { data, error } = await supabase.functions.invoke('get-admin-contacts', {
    body: { workspaceId, page, pageSize }
  })
  if (error) throw error
  return { items: data?.data ?? [], total: data?.total ?? 0 }
}

export async function updateWorkspacePlan(workspaceId: string, newPlan: 'freemium'|'standard'|'premium') {
  const { data, error } = await supabase.functions.invoke('update-user-plan-role', {
    body: { action: 'update_workspace_plan', workspaceId, newPlan }
  })
  if (error) throw error
  return data
}

export async function updateUserRole(userId: string, workspaceId: string, newRole: 'admin'|'gestionnaire'|'lecteur') {
  const { data, error } = await supabase.functions.invoke('update-user-plan-role', {
    body: { action: 'update_user_role', userId, workspaceId, newRole }
  })
  if (error) throw error
  return data
}

export async function deleteWorkspace(workspaceId: string) {
  const { error } = await supabase.functions.invoke('delete-admin-entities', {
    body: { type: 'workspace', id: workspaceId }
  })
  if (error) throw error
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.functions.invoke('delete-admin-entities', {
    body: { type: 'user', id: userId }
  })
  if (error) throw error
}

export async function assignFeSourceToWorkspace(sourceName: string, workspaceId: string) {
  const { data, error } = await supabase.functions.invoke('manage-fe-source-assignments', {
    body: { action: 'assign', source_name: sourceName, workspace_id: workspaceId }
  })
  if (error) throw error
  return data
}

export async function unassignFeSourceFromWorkspace(sourceName: string, workspaceId: string) {
  const { data, error } = await supabase.functions.invoke('manage-fe-source-assignments', {
    body: { action: 'unassign', source_name: sourceName, workspace_id: workspaceId }
  })
  if (error) throw error
  return data
}

export async function syncWorkspaceAssignments(workspaceId: string, assigned: string[], unassigned: string[]) {
  const { data, error } = await supabase.functions.invoke('manage-fe-source-assignments-bulk', {
    body: { workspace_id: workspaceId, assigned, unassigned }
  })
  if (error) throw error
  return data
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
  const { data, error } = await supabase.functions.invoke('manage-workspace-users', {
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
  const { data, error } = await supabase.functions.invoke('manage-workspace-users', {
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
  const { data, error } = await supabase.functions.invoke('manage-workspace-users', {
    body: { action: 'update_role', workspaceId, userId, newRole }
  })
  if (error) throw error
  return data
}

export async function removeUserFromWorkspace(workspaceId: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('manage-workspace-users', {
    body: { action: 'remove_user', workspaceId, userId }
  })
  if (error) throw error
  return data
}

export async function resendWorkspaceInvitation(workspaceId: string, invitationId: string) {
  const { data, error } = await supabase.functions.invoke('manage-workspace-users', {
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
  const { data, error } = await supabase.functions.invoke('process-invitation', {
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
  const { data, error } = await supabase.functions.invoke('process-invitation', {
    body: { action: 'accept', token, userMetadata }
  })
  if (error) throw error
  return data
}

export async function declineInvitation(token: string) {
  const { data, error } = await supabase.functions.invoke('process-invitation', {
    body: { action: 'decline', token }
  })
  if (error) throw error
  return data
}


