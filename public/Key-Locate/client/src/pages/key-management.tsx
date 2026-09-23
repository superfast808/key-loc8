import { useLocation } from "wouter";
import { Key, MapPin, History, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@shared/permissions";

const KeyManagement = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { can } = usePermissions();

  const isOfficer = (user as any)?.role === "officer";
  const allowedSections: string[] = (user as any)?.allowedSections || [];

  function isSectionAllowed(sectionId: string) {
    if (!isOfficer) return true;
    return allowedSections.includes(sectionId);
  }

  const tiles = [
    {
      id: "keys",
      label: "Keys",
      icon: Key,
      href: "/key-bunches",
      color: "blue",
      show: isSectionAllowed("keys") && can(PERMISSIONS.KEY_VIEW),
    },
    {
      id: "locations",
      label: "Locations",
      icon: MapPin,
      href: "/locations",
      color: "indigo",
      show: isSectionAllowed("locations") && can(PERMISSIONS.LOCATION_VIEW),
    },
    {
      id: "history",
      label: "History",
      icon: History,
      href: "/history",
      color: "violet",
      show: isSectionAllowed("history") && can(PERMISSIONS.HISTORY_VIEW),
    },
    {
      id: "audit",
      label: "Audit",
      icon: ClipboardCheck,
      href: "/audit",
      color: "sky",
      show: isSectionAllowed("audit") && can(PERMISSIONS.AUDIT_CREATE),
    },
  ].filter(t => t.show);

  const colorMap: Record<string, { bg: string; icon: string; border: string; text: string }> = {
    blue:   { bg: "bg-blue-50 hover:bg-blue-100",     icon: "text-blue-600",   border: "border-blue-200",   text: "text-blue-900" },
    indigo: { bg: "bg-indigo-50 hover:bg-indigo-100", icon: "text-indigo-600", border: "border-indigo-200", text: "text-indigo-900" },
    violet: { bg: "bg-violet-50 hover:bg-violet-100", icon: "text-violet-600", border: "border-violet-200", text: "text-violet-900" },
    sky:    { bg: "bg-sky-50 hover:bg-sky-100",       icon: "text-sky-600",     border: "border-sky-200",   text: "text-sky-900" },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Key Management</h1>
        <p className="text-gray-500 mt-1">Manage keys, locations, history and audits</p>
      </div>

      <div className={`grid gap-4 ${tiles.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {tiles.map(tile => {
          const c = colorMap[tile.color];
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => setLocation(tile.href)}
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border ${c.bg} ${c.border} transition-all duration-150 cursor-pointer group`}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-white shadow-sm group-hover:shadow-md transition-shadow">
                <Icon className={`w-7 h-7 ${c.icon}`} />
              </div>
              <span className={`font-semibold ${c.text}`}>{tile.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default KeyManagement;
