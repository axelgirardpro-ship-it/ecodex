import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'gestionnaire' | 'supra_admin')[];
  requirePermission?: 'canManageUsers' | 'canImportData' | 'canExport' | 'canAddUsers' | 'canManageWorkspace' | 'canDeleteData' | 'canCopyToClipboard' | 'canAddToFavorites';
  fallback?: ReactNode;
}

export const RoleGuard = ({ 
  children, 
  allowedRoles, 
  requirePermission, 
  fallback = null 
}: RoleGuardProps) => {
  const permissions = usePermissions();
  const { role } = permissions;

  // Check by role
  if (allowedRoles) {
    if (!role || !allowedRoles.includes(role as any)) {
      return <>{fallback}</>;
    }
  }

  // Check by permission
  if (requirePermission) {
    const hasPermission = permissions[requirePermission];
    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};