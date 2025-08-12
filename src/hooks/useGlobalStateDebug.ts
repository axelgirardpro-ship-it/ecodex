import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';

export const useGlobalStateDebug = (componentName: string) => {
  const { user, loading: authLoading } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const permissions = usePermissions();

  useEffect(() => {
    const debugInfo = {
      component: componentName,
      timestamp: new Date().toISOString(),
      user: user ? { id: user.id, email: user.email } : null,
      userProfile: userProfile ? {
        role: userProfile.role,
        workspace_id: userProfile.workspace_id,
        plan_type: userProfile.plan_type,
      } : null,
      currentWorkspace: currentWorkspace ? {
        id: currentWorkspace.id,
        name: currentWorkspace.name,
        plan_type: currentWorkspace.plan_type,
      } : null,
      permissions: {
        isSupraAdmin: permissions.isSupraAdmin,
        canImportData: permissions.canImportData,
        canExport: permissions.canExport,
        canManageUsers: permissions.canManageUsers,
        role: permissions.role,
        planType: permissions.planType,
      },
      loadingStates: {
        authLoading,
        userLoading,
        workspaceLoading,
      },
    };

    console.log(`🔍 [${componentName}] Global State Debug:`, debugInfo);
  }, [
    componentName,
    user?.id,
    userProfile?.role,
    currentWorkspace?.id,
    currentWorkspace?.plan_type,
    permissions.isSupraAdmin,
    authLoading,
    userLoading,
    workspaceLoading,
  ]);

  return {
    debugState: {
      user,
      userProfile,
      currentWorkspace,
      permissions,
      loadingStates: {
        authLoading,
        userLoading,
        workspaceLoading,
      },
    },
  };
};