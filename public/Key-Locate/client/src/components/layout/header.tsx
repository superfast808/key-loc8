import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Key, LayoutDashboard, MapPin, History, ClipboardCheck, Users, LogOut, User, Menu, X, Settings, ChevronDown, Bell, HelpCircle, ShieldCheck, FileText, Building2, Shirt, BookOpen, Download, Smartphone, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useModules } from "@/hooks/useModules";
import { PERMISSIONS, getRoleDisplayName } from "@shared/permissions";
import { MODULE_IDS } from "@shared/modules";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import keylocateLogo from "@assets/ChatGPT Image Oct 30, 2025, 10_58_13 AM_1761821897470.png";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// Route prefixes that belong to each module context
const KEY_MGMT_PATHS = ["/key-management", "/key-bunches", "/locations", "/history", "/audit", "/bulk-move-keys", "/bulk-upload", "/key-history", "/location-report"];
const LONE_WORKING_PATHS = ["/lone-working"];
const ASSIGNMENTS_PATHS = ["/assignment-builder", "/assignment-location"];
const UNIFORM_PATHS = ["/uniform"];
const POLICIES_PATHS = ["/policies"];
const REPORTS_PATHS = ["/reports"];

type ModuleContext = "dashboard" | "key_management" | "lone_working" | "assignments" | "uniform" | "policies" | "reports" | "other";

function getModuleContext(location: string): ModuleContext {
  if (location === "/" || location === "") return "dashboard";
  if (KEY_MGMT_PATHS.some(p => location.startsWith(p))) return "key_management";
  if (LONE_WORKING_PATHS.some(p => location.startsWith(p))) return "lone_working";
  if (ASSIGNMENTS_PATHS.some(p => location.startsWith(p))) return "assignments";
  if (UNIFORM_PATHS.some(p => location.startsWith(p))) return "uniform";
  if (POLICIES_PATHS.some(p => location.startsWith(p))) return "policies";
  if (REPORTS_PATHS.some(p => location.startsWith(p))) return "reports";
  return "other";
}

const Header = () => {
  const [location] = useLocation();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { hasModule, isPlatformAdmin } = useModules();
  const { toast } = useToast();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";
  const isOfficer = (user as any)?.role === "officer";
  const allowedSections: string[] = (user as any)?.allowedSections || [];
  const { canInstall, isIOS, triggerInstall } = useInstallPrompt();

  async function handleInstall() {
    const result = await triggerInstall();
    if (result === "ios") {
      toast({
        title: "Install on iPhone / iPad",
        description: "Open this page in Safari, tap the Share button, then select \"Add to Home Screen\".",
      });
    } else if (result === "instructions") {
      toast({
        title: "Install the app",
        description: "In your browser's address bar, look for the install icon (⊕) or open the browser menu and choose \"Install app\" or \"Add to Home Screen\".",
      });
    }
  }

  function isSectionAllowed(sectionId: string) {
    if (!isOfficer) return true;
    return allowedSections.includes(sectionId);
  }

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Logged out", description: "You have been successfully logged out" });
      window.location.href = "/login";
    },
    onError: () => { queryClient.clear(); window.location.href = "/login"; },
  });

  // Determine which module the user is currently in
  const moduleContext = getModuleContext(location);

  // Dashboard link — always present
  const dashboardItem = { name: "Dashboard", href: "/", icon: LayoutDashboard };

  // Context-specific nav items
  const contextNav = (() => {
    switch (moduleContext) {
      case "key_management":
        return [
          ...(isSectionAllowed("keys") && can(PERMISSIONS.KEY_VIEW)
            ? [{ name: "Keys", href: "/key-bunches", icon: Key }] : []),
          ...(isSectionAllowed("locations") && can(PERMISSIONS.LOCATION_VIEW)
            ? [{ name: "Locations", href: "/locations", icon: MapPin }] : []),
          ...(isSectionAllowed("history") && can(PERMISSIONS.HISTORY_VIEW)
            ? [{ name: "History", href: "/history", icon: History }] : []),
          ...(isSectionAllowed("audit") && can(PERMISSIONS.AUDIT_CREATE)
            ? [{ name: "Audit", href: "/audit", icon: ClipboardCheck }] : []),
        ];

      case "lone_working":
        return hasModule(MODULE_IDS.LONE_WORKING) && isSectionAllowed("lone_working")
          ? [{ name: "Lone Working", href: "/lone-working", icon: ShieldCheck }]
          : [];

      case "assignments":
        return hasModule(MODULE_IDS.ASSIGNMENT_BUILDER) && isSectionAllowed("assignments")
          ? [{ name: "Assignments", href: "/assignment-builder", icon: FileText }]
          : [];

      case "uniform":
        return hasModule(MODULE_IDS.UNIFORM) && (isAdmin || isSectionAllowed("uniform"))
          ? [{ name: "Uniform", href: "/uniform", icon: Shirt }]
          : [];

      case "policies":
        return hasModule(MODULE_IDS.POLICIES) && isSectionAllowed("policies")
          ? [{ name: "Policies", href: "/policies", icon: BookOpen }]
          : [];

      case "reports":
        return hasModule(MODULE_IDS.REPORTS) && isSectionAllowed("reports") && can(PERMISSIONS.REPORTS_VIEW)
          ? [{ name: "Reports", href: "/reports", icon: ClipboardList }]
          : [];

      default:
        return [];
    }
  })();

  const allNav = [dashboardItem, ...contextNav];

  function isActive(href: string) {
    if (href === "/") return location === "/" || location === "/key-management";
    return location.startsWith(href);
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <img src={keylocateLogo} alt="keylocate" className="h-24 sm:h-32 w-auto" />
            </Link>
            <nav className="hidden md:flex space-x-1">
              {allNav.map((item) => (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center space-x-2",
                      isActive(item.href)
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Desktop User Dropdown */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 hover:bg-gray-100 p-2 rounded-lg">
                    <div className="rounded-full bg-blue-100 p-2">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {(user as any)?.firstName && (user as any)?.lastName
                          ? `${(user as any).firstName} ${(user as any).lastName}`
                          : (user as any)?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isPlatformAdmin ? "Platform Admin" : getRoleDisplayName((user as any)?.role || "officer")}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2 border-b">
                    <div className="font-medium text-sm text-gray-900">
                      {(user as any)?.firstName && (user as any)?.lastName
                        ? `${(user as any).firstName} ${(user as any).lastName}`
                        : (user as any)?.email?.split("@")[0] || "User"}
                    </div>
                    <div className="text-xs text-gray-500">{(user as any)?.email}</div>
                  </div>

                  {!isPlatformAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 w-full">
                        <User className="h-4 w-4" />My Profile
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {isPlatformAdmin && (
                    <>
                      <DropdownMenuLabel className="text-xs text-gray-400 font-normal px-3 py-1">Platform</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/platform-admin" className="flex items-center gap-2 w-full">
                          <Building2 className="h-4 w-4" />Platform Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {!isPlatformAdmin && can(PERMISSIONS.USER_VIEW) && (
                    <DropdownMenuItem asChild>
                      <Link href="/users" className="flex items-center gap-2 w-full">
                        <Users className="h-4 w-4" />User Management
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {!isPlatformAdmin && can(PERMISSIONS.SYSTEM_ADMIN) && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2 w-full">
                        <Settings className="h-4 w-4" />Settings
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {!isPlatformAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/help" className="flex items-center gap-2 w-full">
                        <HelpCircle className="h-4 w-4" />Help &amp; Guide
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {canInstall && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleInstall} className="flex items-center gap-2">
                        {isIOS ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                        Install App
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {logoutMutation.isPending ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t bg-white mt-4 pt-4">
            <nav className="space-y-2">
              {allNav.map((item) => (
                <Link key={item.name} href={item.href} onClick={() => setShowMobileMenu(false)}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start flex items-center space-x-3 h-12 text-base",
                      isActive(item.href)
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              ))}

              {/* Mobile User Menu */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-100 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {(user as any)?.firstName && (user as any)?.lastName
                        ? `${(user as any).firstName} ${(user as any).lastName}`
                        : (user as any)?.email?.split("@")[0] || "User"}
                    </div>
                    <div className="text-xs text-gray-500">{(user as any)?.email}</div>
                  </div>
                </div>

                {!isPlatformAdmin && (
                  <Link href="/profile">
                    <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileMenu(false)}>
                      <User className="h-5 w-5" />My Profile
                    </Button>
                  </Link>
                )}

                {isPlatformAdmin && (
                  <Link href="/platform-admin">
                    <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileMenu(false)}>
                      <Building2 className="h-5 w-5" />Platform Admin
                    </Button>
                  </Link>
                )}

                {!isPlatformAdmin && can(PERMISSIONS.USER_VIEW) && (
                  <Link href="/users">
                    <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileMenu(false)}>
                      <Users className="h-5 w-5" />User Management
                    </Button>
                  </Link>
                )}

                {!isPlatformAdmin && can(PERMISSIONS.SYSTEM_ADMIN) && (
                  <Link href="/settings">
                    <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileMenu(false)}>
                      <Settings className="h-5 w-5" />Settings
                    </Button>
                  </Link>
                )}

                {!isPlatformAdmin && (
                  <Link href="/help">
                    <Button variant="ghost" className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileMenu(false)}>
                      <HelpCircle className="h-5 w-5" />Help &amp; Guide
                    </Button>
                  </Link>
                )}

                {canInstall && (
                  <Button
                    variant="ghost"
                    onClick={() => { setShowMobileMenu(false); handleInstall(); }}
                    className="w-full justify-start gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {isIOS ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
                    Install App
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={() => { setShowMobileMenu(false); logoutMutation.mutate(); }}
                  disabled={logoutMutation.isPending}
                  className="w-full justify-start flex items-center space-x-3 h-12 text-base text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{logoutMutation.isPending ? "Signing out..." : "Sign out"}</span>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
