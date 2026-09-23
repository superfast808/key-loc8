import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import Header from "@/components/layout/header";
import { useState } from "react";
import { GlobalNFCListener } from "@/components/global-nfc-listener";
import { OfflineIndicator } from "@/components/offline-indicator";


import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import KeyBunches from "@/pages/key-bunches";
import Locations from "@/pages/locations";
import History from "@/pages/history";
import NotFound from "@/pages/not-found";
import BulkMoveKeys from "@/pages/bulk-move-keys";
import BulkUpload from "@/pages/bulk-upload";
import LocationReport from "@/pages/location-report";
import AuditLocation from "@/pages/audit-location";
import UserManagement from "@/pages/user-management";
import KeyHistory from "@/pages/key-history";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import Help from "@/pages/help";

import CompanySetup from "@/pages/company-setup";
import Landing from "@/pages/landing";
import AuthLogin from "@/pages/auth-login";
import AuthSignup from "@/pages/auth-signup";
import AuthForgotPassword from "@/pages/auth-forgot-password";
import AuthResetPassword from "@/pages/auth-reset-password";
import PlatformAdmin from "@/pages/platform-admin";
import LoneWorking from "@/pages/lone-working/index";
import LoneWorkingCheckIn from "@/pages/lone-working/check-in";
import LoneWorkingActiveSession from "@/pages/lone-working/active-session";
import AssignmentBuilder from "@/pages/assignment-builder";
import AssignmentLocation from "@/pages/assignment-location";
import { CustomerPortalLogin, CustomerPortalInvite, CustomerPortalDashboard, CustomerPortalLocation } from "@/pages/customer-portal";
import UniformPage from "@/pages/uniform/index";
import KeyManagement from "@/pages/key-management";
import PoliciesPage from "@/pages/policies";
import ReportsPage from "@/pages/reports/index";
import ReportsManage from "@/pages/reports/manage";
import ReportsBuilder from "@/pages/reports/builder";
import ReportsFill from "@/pages/reports/fill";
import ReportsSubmissions from "@/pages/reports/submissions";
import ReportsSubmissionDetail from "@/pages/reports/submission-detail";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { needsCompanySetup, isPlatformAdmin, isLoading: companyLoading } = useCompany();

  // Customer portal is fully separate — available without staff authentication
  const path = window.location.pathname;
  if (path.startsWith("/customer-portal")) {
    return (
      <Switch>
        <Route path="/customer-portal/invite/:token" component={CustomerPortalInvite} />
        <Route path="/customer-portal/dashboard" component={CustomerPortalDashboard} />
        <Route path="/customer-portal/location/:locationId" component={CustomerPortalLocation} />
        <Route path="/customer-portal" component={CustomerPortalLogin} />
      </Switch>
    );
  }

  if (isLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/signup" component={CompanySetup} />
        <Route path="/auth/login" component={AuthLogin} />
        <Route path="/auth/signup" component={AuthSignup} />
        <Route path="/auth/forgot-password" component={AuthForgotPassword} />
        <Route path="/auth/reset-password" component={AuthResetPassword} />
        <Route path="/login" component={Login} />
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  if (needsCompanySetup) {
    return <CompanySetup />;
  }

  return (
    <AppWithHeader>
      <Switch>
        {/* Platform admins land on the platform admin page */}
        <Route path="/" component={isPlatformAdmin ? PlatformAdmin : Dashboard} />
        <Route path="/key-management" component={KeyManagement} />
        <Route path="/key-bunches" component={() => <SectionGuard section="keys" component={KeyBunches} />} />
        <Route path="/locations" component={() => <SectionGuard section="locations" component={Locations} />} />
        <Route path="/audit" component={() => <SectionGuard section="audit" component={AuditLocation} />} />
        <Route path="/history" component={() => <SectionGuard section="history" component={History} />} />
        <Route path="/bulk-move-keys" component={() => <SectionGuard section="keys" component={BulkMoveKeys} />} />
        <Route path="/bulk-upload" component={() => <SectionGuard section="keys" component={BulkUpload} />} />
        <Route path="/location-report/:locationId" component={() => <SectionGuard section="locations" component={LocationReport} />} />
        <Route path="/key-history/:id" component={() => <SectionGuard section="history" component={KeyHistory} />} />
        <Route path="/users" component={UserManagement} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/help" component={Help} />
        <Route path="/platform-admin" component={PlatformAdmin} />
        <Route path="/lone-working/check-in" component={() => <SectionGuard section="lone_working" component={LoneWorkingCheckIn} />} />
        <Route path="/lone-working/active" component={() => <SectionGuard section="lone_working" component={LoneWorkingActiveSession} />} />
        <Route path="/lone-working" component={() => <SectionGuard section="lone_working" component={LoneWorking} />} />
        <Route path="/assignment-builder" component={() => <SectionGuard section="assignments" component={AssignmentBuilder} />} />
        <Route path="/assignment-location" component={() => <SectionGuard section="assignments" component={AssignmentLocation} />} />
        <Route path="/uniform" component={() => <AdminGuard component={UniformPage} />} />
        <Route path="/policies" component={() => <SectionGuard section="policies" component={PoliciesPage} />} />
        <Route path="/reports" component={() => <SectionGuard section="reports" component={ReportsPage} />} />
        <Route path="/reports/manage" component={() => <SectionGuard section="reports" component={ReportsManage} />} />
        <Route path="/reports/builder/new" component={() => <SectionGuard section="reports" component={ReportsBuilder} />} />
        <Route path="/reports/builder/:id" component={() => <SectionGuard section="reports" component={ReportsBuilder} />} />
        <Route path="/reports/fill/:id" component={() => <SectionGuard section="reports" component={ReportsFill} />} />
        <Route path="/reports/submissions/:id" component={() => <SectionGuard section="reports" component={ReportsSubmissions} />} />
        <Route path="/reports/submission/:id" component={() => <SectionGuard section="reports" component={ReportsSubmissionDetail} />} />

        {/* Redirect auth pages to dashboard for authenticated users */}
        <Route path="/login" component={() => { window.location.href = "/"; return null; }} />
        <Route path="/signup" component={() => { window.location.href = "/"; return null; }} />
        <Route path="/auth/login" component={() => { window.location.href = "/"; return null; }} />
        <Route path="/auth/signup" component={() => { window.location.href = "/"; return null; }} />
        <Route component={NotFound} />
      </Switch>
    </AppWithHeader>
  );
}

function AdminGuard({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = (user as any)?.role;
  if (role !== "admin" && role !== "super_admin") {
    navigate("/");
    return null;
  }
  return <Component />;
}

// Blocks officers from reaching a page via direct URL when their
// `allowedSections` list doesn't include the section. Admin and super_admin
// roles bypass section gating (matching the header/dashboard behavior).
function SectionGuard({
  section,
  component: Component,
}: {
  section: string;
  component: React.ComponentType;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = (user as any)?.role;
  const allowedSections: string[] = (user as any)?.allowedSections || [];
  if (role === "officer" && !allowedSections.includes(section)) {
    navigate("/");
    return null;
  }
  return <Component />;
}

function AppWithHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <GlobalNFCListener />
      <OfflineIndicator />
      <main className="p-3 sm:p-6">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
