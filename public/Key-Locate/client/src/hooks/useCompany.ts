import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export function useCompany() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["/api/companies/current"],
    enabled: isAuthenticated && !!user?.companyId,
    retry: false,
  });

  // Platform admins have no companyId intentionally — don't redirect them to setup
  const isPlatformAdmin = isAuthenticated && !!user && !user?.companyId && (user as any)?.role === 'super_admin';

  return {
    company,
    hasCompany: !!user?.companyId,
    needsCompanySetup: isAuthenticated && !!user && !user?.companyId && !isPlatformAdmin,
    isLoading: authLoading || (isAuthenticated && companyLoading),
    isPlatformAdmin,
  };
}