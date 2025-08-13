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


