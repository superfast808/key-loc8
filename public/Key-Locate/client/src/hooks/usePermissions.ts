import { useAuth } from "./useAuth";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, hasPermission, hasAnyPermission, hasAllPermissions, canAccessLocation } from "@shared/permissions";
import type { Permission, Role } from "@shared/permissions";

export function usePermissions() {
  const { user } = useAuth();

  const getUserPermissions = (): string[] => {
    if (!user) return [];
    
    // Super admin has all permissions
    if (user.role === ROLES.SUPER_ADMIN) {
      return Object.values(PERMISSIONS);
    }
    
    // Use custom permissions if set, otherwise use role defaults
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions;
    }
    
    // Use default role permissions
    return ROLE_PERMISSIONS[user.role as Role] || [];
  };

  const getUserLocations = (): number[] => {
    if (!user) return [];

    // Super admin bypasses location restrictions entirely.
    if (user.role === ROLES.SUPER_ADMIN) {
      return [];
    }

    // For everyone else, only the explicitly granted locations are accessible.
    return user.allowedLocationIds;
  };

  const can = (permission: Permission): boolean => {
    const userPermissions = getUserPermissions();
    return hasPermission(userPermissions, permission);
  };

  const canAny = (permissions: Permission[]): boolean => {
    const userPermissions = getUserPermissions();
    return hasAnyPermission(userPermissions, permissions);
  };

  const canAll = (permissions: Permission[]): boolean => {
    const userPermissions = getUserPermissions();
    return hasAllPermissions(userPermissions, permissions);
  };

  const canAccess = (locationId: number): boolean => {
    if (user?.role === ROLES.SUPER_ADMIN) return true;
    const userLocations = getUserLocations();
    return canAccessLocation(userLocations, locationId);
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === ROLES.SUPER_ADMIN;
  };

  const isAdmin = (): boolean => {
    return user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;
  };

  const isOfficer = (): boolean => {
    return user?.role === ROLES.OFFICER;
  };

  const isViewer = (): boolean => {
    return user?.role === ROLES.VIEWER;
  };

  return {
    user,
    permissions: getUserPermissions(),
    allowedLocations: getUserLocations(),
    can,
    canAny,
    canAll,
    canAccess,
    isSuperAdmin,
    isAdmin,
    isOfficer,
    isViewer,
  };
}