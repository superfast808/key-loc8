// Platform module definitions
// Each module represents a distinct product feature that can be subscribed to

export const MODULE_IDS = {
  KEYLOCATE: 'keylocate',
  LONE_WORKING: 'lone_working',
  ASSIGNMENT_BUILDER: 'assignment_builder',
  UNIFORM: 'uniform',
  POLICIES: 'policies',
  REPORTS: 'reports',
} as const;

export type ModuleId = typeof MODULE_IDS[keyof typeof MODULE_IDS];

export interface PlatformModule {
  id: ModuleId;
  name: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  routes: string[]; // URL prefixes this module uses
  comingSoon?: boolean;
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: MODULE_IDS.KEYLOCATE,
    name: 'keylocate',
    description: 'Full key management system with audit trails, NFC scanning, location tracking, and movement history.',
    icon: 'Key',
    color: 'blue',
    routes: ['/key-bunches', '/locations', '/audit', '/history', '/bulk-move-keys', '/bulk-upload'],
  },
  {
    id: MODULE_IDS.LONE_WORKING,
    name: 'Lone Working',
    description: 'Monitor and protect lone workers with check-in/check-out, welfare calls, GPS tracking, and escalation alerts.',
    icon: 'ShieldCheck',
    color: 'green',
    routes: ['/lone-working'],
    comingSoon: false,
  },
  {
    id: MODULE_IDS.ASSIGNMENT_BUILDER,
    name: 'Assignment Instructions Builder',
    description: 'Create, manage and distribute assignment instructions and post orders to your teams with version control and sign-off tracking.',
    icon: 'FileText',
    color: 'purple',
    routes: ['/assignment-builder'],
    comingSoon: false,
  },
  {
    id: MODULE_IDS.UNIFORM,
    name: 'Uniform & Equipment',
    description: 'Stock control for uniform and equipment. Track issuing, returns, sizes and per-employee holdings with full audit trail and signature capture.',
    icon: 'Shirt',
    color: 'amber',
    routes: ['/uniform'],
    comingSoon: false,
  },
  {
    id: MODULE_IDS.POLICIES,
    name: 'Policies',
    description: 'Upload, manage and distribute company policies and documents to staff. Control per-user document access.',
    icon: 'BookOpen',
    color: 'teal',
    routes: ['/policies'],
    comingSoon: false,
  },
  {
    id: MODULE_IDS.REPORTS,
    name: 'Reports',
    description: 'Build custom report forms with any fields you need. Staff fill them in; admins control who can submit and who can view results.',
    icon: 'ClipboardList',
    color: 'orange',
    routes: ['/reports'],
    comingSoon: false,
  },
];

export function getModule(id: ModuleId): PlatformModule | undefined {
  return PLATFORM_MODULES.find(m => m.id === id);
}
