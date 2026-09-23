import { useLocation } from "wouter";
import { Key, ShieldCheck, FileText, Shirt, ArrowRight, BookOpen, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULE_IDS } from "@shared/modules";
import { PERMISSIONS } from "@shared/permissions";

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { hasModule } = useModules();
  const { can } = usePermissions();

  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";
  const isOfficer = (user as any)?.role === "officer";
  const allowedSections: string[] = (user as any)?.allowedSections || [];

  function isSectionAllowed(sectionId: string) {
    if (!isOfficer) return true;
    return allowedSections.includes(sectionId);
  }

  const keyMgmtSections = ["keys", "locations", "history", "audit"];
  const canSeeKeyManagement =
    hasModule(MODULE_IDS.KEYLOCATE) &&
    keyMgmtSections.some(s => isSectionAllowed(s)) &&
    can(PERMISSIONS.KEY_VIEW);

  const tiles = [
    {
      id: "key_management",
      label: "Key Management",
      description: "Keys, locations, history and audits",
      icon: Key,
      href: "/key-bunches",
      color: "blue",
      show: canSeeKeyManagement,
    },
    {
      id: "lone_working",
      label: "Lone Working",
      description: "Check-ins, welfare alerts and shifts",
      icon: ShieldCheck,
      href: "/lone-working",
      color: "green",
      show: hasModule(MODULE_IDS.LONE_WORKING) && isSectionAllowed("lone_working"),
    },
    {
      id: "assignments",
      label: "Assignments",
      description: "Post orders and assignment instructions",
      icon: FileText,
      href: "/assignment-builder",
      color: "purple",
      show: hasModule(MODULE_IDS.ASSIGNMENT_BUILDER) && isSectionAllowed("assignments"),
    },
    {
      id: "uniform",
      label: "Uniform & Equipment",
      description: "Stock control, issuing and returns",
      icon: Shirt,
      href: "/uniform",
      color: "amber",
      show: hasModule(MODULE_IDS.UNIFORM) && (isAdmin || isSectionAllowed("uniform")),
    },
    {
      id: "policies",
      label: "Policies",
      description: "Company policies and documents",
      icon: BookOpen,
      href: "/policies",
      color: "teal",
      show: hasModule(MODULE_IDS.POLICIES) && isSectionAllowed("policies"),
    },
    {
      id: "reports",
      label: "Reports",
      description: "Custom reports built and submitted by your team",
      icon: ClipboardList,
      href: "/reports",
      color: "orange",
      show: hasModule(MODULE_IDS.REPORTS) && isSectionAllowed("reports") && can(PERMISSIONS.REPORTS_VIEW),
    },
  ].filter(t => t.show);

  const colorMap: Record<string, { bg: string; icon: string; border: string; text: string }> = {
    blue:   { bg: "bg-blue-50 hover:bg-blue-100",     icon: "text-blue-600",   border: "border-blue-200",   text: "text-blue-900" },
    green:  { bg: "bg-green-50 hover:bg-green-100",   icon: "text-green-600",  border: "border-green-200",  text: "text-green-900" },
    purple: { bg: "bg-purple-50 hover:bg-purple-100", icon: "text-purple-600", border: "border-purple-200", text: "text-purple-900" },
    amber:  { bg: "bg-amber-50 hover:bg-amber-100",   icon: "text-amber-600",  border: "border-amber-200",  text: "text-amber-900" },
    teal:   { bg: "bg-teal-50 hover:bg-teal-100",     icon: "text-teal-600",   border: "border-teal-200",   text: "text-teal-900" },
    orange: { bg: "bg-orange-50 hover:bg-orange-100", icon: "text-orange-600", border: "border-orange-200", text: "text-orange-900" },
  };

  const firstName = (user as any)?.firstName || (user as any)?.email?.split("@")[0] || "there";

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, {firstName}</h1>
        <p className="text-gray-500 mt-1">Select a module to get started</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map(tile => {
          const c = colorMap[tile.color];
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => setLocation(tile.href)}
              className={`flex items-center gap-4 p-5 rounded-2xl border ${c.bg} ${c.border} transition-all duration-150 cursor-pointer group text-left`}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-white shadow-sm shrink-0 group-hover:shadow-md transition-shadow">
                <Icon className={`w-7 h-7 ${c.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${c.text}`}>{tile.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tile.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0" />
            </button>
          );
        })}
      </div>

      {tiles.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No modules are available for your account.</p>
          <p className="text-xs mt-1">Contact your administrator if you believe this is an error.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
