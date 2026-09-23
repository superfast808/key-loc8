// Permission constants and utility functions
export const PERMISSIONS = {
  // User Management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_PERMISSIONS: 'user:assign_permissions',
  
  // Location Management
  LOCATION_VIEW: 'location:view',
  LOCATION_CREATE: 'location:create',
  LOCATION_EDIT: 'location:edit',
  LOCATION_DELETE: 'location:delete',
  
  // Key Management
  KEY_VIEW: 'key:view',
  KEY_CREATE: 'key:create',
  KEY_EDIT: 'key:edit',
  KEY_DELETE: 'key:delete',
  KEY_ISSUE: 'key:issue',
  KEY_RETURN: 'key:return',
  KEY_MOVE: 'key:move',
  KEY_BULK_MOVE: 'key:bulk_move',
  
  // Audit Management
  AUDIT_VIEW: 'audit:view',
  AUDIT_CREATE: 'audit:create',
  AUDIT_EDIT: 'audit:edit',
  AUDIT_DELETE: 'audit:delete',
  
  // Reports and History
  HISTORY_VIEW: 'history:view',
  REPORTS_VIEW: 'reports:view',
  REPORTS_CREATE: 'reports:create',
  REPORTS_EDIT: 'reports:edit',
  REPORTS_DELETE: 'reports:delete',
  REPORTS_EXPORT: 'reports:export',
  
  // System Management
  SYSTEM_ADMIN: 'system:admin',
} as const;

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OFFICER: 'officer',
  VIEWER: 'viewer',
} as const;

// Default permissions for each role
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    // Super admin has all permissions
    ...Object.values(PERMISSIONS)
  ],
  
  [ROLES.ADMIN]: [
    // Admin can manage most things but not users or system settings
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.LOCATION_CREATE,
    PERMISSIONS.LOCATION_EDIT,
    PERMISSIONS.KEY_VIEW,
    PERMISSIONS.KEY_CREATE,
    PERMISSIONS.KEY_EDIT,
    PERMISSIONS.KEY_ISSUE,
    PERMISSIONS.KEY_RETURN,
    PERMISSIONS.KEY_MOVE,
    PERMISSIONS.KEY_BULK_MOVE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_CREATE,
    PERMISSIONS.AUDIT_EDIT,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_EDIT,
    PERMISSIONS.REPORTS_DELETE,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  
  [ROLES.OFFICER]: [
    // Staff can view and perform basic operations
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.KEY_VIEW,
    PERMISSIONS.KEY_EDIT,
    PERMISSIONS.KEY_ISSUE,
    PERMISSIONS.KEY_RETURN,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_CREATE,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CREATE,
  ],
  
  [ROLES.VIEWER]: [
    // Viewer can only view data
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.KEY_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
};

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type Role = typeof ROLES[keyof typeof ROLES];

// Utility functions
export function hasPermission(userPermissions: string[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: Permission[]): boolean {
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}

export function canAccessLocation(userLocationIds: number[], locationId: number): boolean {
  // Users must be explicitly granted access to each location.
  // Empty array means no location access. Super admin bypass is handled at the call site.
  return userLocationIds.includes(locationId);
}

export function getRoleDisplayName(role: Role): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'Super Administrator';
    case ROLES.ADMIN:
      return 'Administrator';
    case ROLES.OFFICER:
      return 'Staff Member';
    case ROLES.VIEWER:
      return 'Viewer';
    default:
      return role;
  }
}

export function getPermissionDisplayName(permission: Permission): string {
  const [category, action] = permission.split(':');
  const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
  const actionName = action.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  return `${categoryName}: ${actionName}`;
}