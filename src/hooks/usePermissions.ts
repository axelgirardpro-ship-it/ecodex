import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSupraAdmin } from "@/hooks/useSupraAdmin";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export const usePermissions = () => {
  const { user } = useAuth();
  const { userProfile } = useUser();
  const { isSupraAdmin } = useSupraAdmin();
  const { currentWorkspace } = useWorkspace();

  // Can import data: admin on Pro workspace, or supra_admin
  // Note: plan_type comes from workspace, not from user profile
  const planType = currentWorkspace?.plan_type || 'freemium';
  const isPro = planType === 'pro';
  const canImportData = isSupraAdmin || (isPro && userProfile?.role === 'admin');
  
  // Can export: gestionnaire or admin (will be managed by quota system)
  const canExport = isSupraAdmin || userProfile?.role === 'admin' || userProfile?.role === 'gestionnaire';
  
  // Can copy to clipboard: gestionnaire or admin (will be managed by quota system)
  const canCopyToClipboard = isSupraAdmin || userProfile?.role === 'admin' || userProfile?.role === 'gestionnaire';
  
  // Can add to favorites: gestionnaire or admin (will be managed by quota system)
  const canAddToFavorites = isSupraAdmin || userProfile?.role === 'admin' || userProfile?.role === 'gestionnaire';
  
  // Can manage users: admin or supra_admin only
  const canManageUsers = isSupraAdmin || userProfile?.role === 'admin';
  
  // Can manage workspace: admin or supra_admin only
  const canManageWorkspace = isSupraAdmin || userProfile?.role === 'admin';
  
  // Can delete data: admin or supra_admin only
  const canDeleteData = isSupraAdmin || userProfile?.role === 'admin';
  
  // Can add users (alias for canManageUsers for backward compatibility)
  const canAddUsers = canManageUsers;

  return {
    isSupraAdmin,
    canImportData,
    canExport,
    canCopyToClipboard,
    canAddToFavorites,
    canManageUsers,
    canManageWorkspace,
    canDeleteData,
    canAddUsers, // Backward compatibility
    role: userProfile?.role,
    // La source de vérité pour le plan est le workspace
    planType
  };
};