import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { MODULE_IDS, type ModuleId } from "@shared/modules";

interface CompanyModuleStatus {
  moduleId: string;
  isEnabled: boolean;
}

/**
 * Returns the list of enabled modules for the current user's company.
 * Falls back to keylocate-only if no module data exists (backward compatible).
 */
export function useModules() {
  const { user, isAuthenticated } = useAuth();

  const { data: modules, isLoading } = useQuery<CompanyModuleStatus[]>({
    queryKey: ["/api/company/modules"],
    enabled: isAuthenticated,
  });

  /**
   * Check if a module is enabled.
   * Keylocate defaults to true if no data yet (backward compat).
   */
  function hasModule(moduleId: ModuleId): boolean {
    if (!modules) {
      // Default: keylocate always enabled for existing companies
      return moduleId === MODULE_IDS.KEYLOCATE;
    }
    const entry = modules.find((m) => m.moduleId === moduleId);
    if (!entry) {
      // Not yet in the DB — keylocate defaults to enabled
      return moduleId === MODULE_IDS.KEYLOCATE;
    }
    return entry.isEnabled;
  }

  // Platform admins (no companyId) can see the platform admin panel
  const isPlatformAdmin =
    isAuthenticated &&
    (user as any)?.role === "super_admin" &&
    !(user as any)?.companyId;

  return { modules, hasModule, isLoading, isPlatformAdmin };
}
