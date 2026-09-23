export interface AppSettings {
  keyTypes: SettingItem[];
  statuses: SettingItem[];
  locationTypes: SettingItem[];
  actions: SettingItem[];
}

export interface SettingItem {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  isDefault?: boolean;
}

export const DEFAULT_KEY_TYPES: SettingItem[] = [
  {
    id: "day_shift",
    name: "day_shift",
    displayName: "Day Shift",
    description: "Keys for regular business hours",
    color: "#3B82F6",
    isActive: true,
    isDefault: true,
  },
  {
    id: "night_shift",
    name: "night_shift",
    displayName: "Night Shift",
    description: "Keys for after-hours access",
    color: "#8B5CF6",
    isActive: true,
    isDefault: true,
  },
  {
    id: "lock_ups",
    name: "lock_ups",
    displayName: "Lock Ups",
    description: "Keys for storage and secure areas",
    color: "#DC2626",
    isActive: true,
    isDefault: true,
  },
  {
    id: "static",
    name: "static",
    displayName: "Static",
    description: "Permanently assigned building keys",
    color: "#059669",
    isActive: true,
    isDefault: true,
  },
];

export const DEFAULT_STATUSES: SettingItem[] = [
  {
    id: "active",
    name: "active",
    displayName: "Present",
    description: "Available for use",
    color: "#059669",
    isActive: true,
    isDefault: true,
  },
  {
    id: "issued",
    name: "issued",
    displayName: "Issued",
    description: "Currently signed out to staff",
    color: "#d97706",
    isActive: true,
    isDefault: true,
  },
  {
    id: "missing",
    name: "missing",
    displayName: "Missing",
    description: "Cannot be located",
    color: "#dc2626",
    isActive: true,
    isDefault: true,
  },
  {
    id: "inactive",
    name: "inactive",
    displayName: "Inactive",
    description: "Out of service",
    color: "#6b7280",
    isActive: true,
    isDefault: true,
  },
];

export const DEFAULT_LOCATION_TYPES: SettingItem[] = [
  {
    id: "vehicle",
    name: "vehicle",
    displayName: "Vehicle",
    description: "Mobile business vehicle",
    color: "#3b82f6",
    icon: "Truck",
    isActive: true,
    isDefault: true,
  },
  {
    id: "office",
    name: "office",
    displayName: "Office",
    description: "Fixed office location",
    color: "#059669",
    icon: "Building2",
    isActive: true,
    isDefault: true,
  },
  {
    id: "building",
    name: "building",
    displayName: "Building",
    description: "Business building or facility",
    color: "#6366f1",
    icon: "Building",
    isActive: true,
    isDefault: true,
  },
  {
    id: "workshop",
    name: "workshop",
    displayName: "Workshop",
    description: "Service or maintenance facility",
    color: "#f59e0b",
    icon: "Wrench",
    isActive: true,
    isDefault: true,
  },
  {
    id: "depot",
    name: "depot",
    displayName: "Depot",
    description: "Storage or distribution center",
    color: "#10b981",
    icon: "Warehouse",
    isActive: true,
    isDefault: true,
  },
];

export const DEFAULT_ACTIONS: SettingItem[] = [
  {
    id: "issue",
    name: "issue",
    displayName: "Issue",
    description: "Key issued to officer",
    color: "#d97706",
    isActive: true,
    isDefault: true,
  },
  {
    id: "return",
    name: "return",
    displayName: "Return",
    description: "Key returned from officer",
    color: "#059669",
    isActive: true,
    isDefault: true,
  },
  {
    id: "move",
    name: "move",
    displayName: "Move",
    description: "Key moved between locations",
    color: "#3b82f6",
    isActive: true,
    isDefault: true,
  },
  {
    id: "status_change",
    name: "status_change",
    displayName: "Status Change",
    description: "Key status updated",
    color: "#8b5cf6",
    isActive: true,
    isDefault: true,
  },
  {
    id: "audit_edit",
    name: "audit_edit",
    displayName: "Audit Edit",
    description: "Key updated during audit",
    color: "#06b6d4",
    isActive: true,
    isDefault: true,
  },
  {
    id: "deleted",
    name: "deleted",
    displayName: "Deleted",
    description: "Key bunch permanently removed from system",
    color: "#ef4444",
    isActive: true,
    isDefault: true,
  },
];