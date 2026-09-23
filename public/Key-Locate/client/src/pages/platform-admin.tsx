import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PLATFORM_MODULES, type ModuleId } from "@shared/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Key, ShieldCheck, FileText, BarChart3, Search,
  ChevronDown, ChevronRight, AlertCircle, DatabaseBackup, Download, RefreshCw, Clock,
} from "lucide-react";

const MODULE_ICONS: Record<string, any> = {
  Key,
  ShieldCheck,
  FileText,
  BarChart3,
};

const MODULE_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

interface CompanyWithModules {
  id: number;
  name: string;
  slug: string;
  planType: string;
  isActive: boolean;
  adminEmail?: string;
  createdAt: string;
  modules: { moduleId: string; isEnabled: boolean }[];
}

interface Backup {
  id: number;
  company_id: number;
  created_at: string;
  triggered_by: string;
  size_bytes: number;
  record_counts: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BackupPanel({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { toast } = useToast();

  const { data: backups, isLoading, refetch } = useQuery<Backup[]>({
    queryKey: ["/api/platform/companies", companyId, "backups"],
    queryFn: async () => {
      const res = await fetch(`/api/platform/companies/${companyId}/backups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load backups");
      return res.json();
    },
  });

  const backupMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/platform/companies/${companyId}/backups`, {}),
    onSuccess: () => {
      toast({ title: "Backup created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies", companyId, "backups"] });
    },
    onError: () => {
      toast({ title: "Backup failed", variant: "destructive" });
    },
  });

  function downloadBackup(backupId: number, date: string) {
    const link = document.createElement("a");
    link.href = `/api/platform/backups/${backupId}/download`;
    link.download = `${companyName}-backup-${date.split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Data Backups</span>
          <span className="text-xs text-gray-400">(daily, keeps 30)</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => backupMutation.mutate()}
          disabled={backupMutation.isPending}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${backupMutation.isPending ? "animate-spin" : ""}`} />
          {backupMutation.isPending ? "Backing up…" : "Back Up Now"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400 py-2">Loading backup history…</div>
      ) : !backups || backups.length === 0 ? (
        <div className="text-xs text-gray-400 py-2 bg-gray-50 rounded-lg px-3">
          No backups yet — the first scheduled backup will run at 2am, or click "Back Up Now".
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {backups.map((b) => {
            const counts = b.record_counts ? JSON.parse(b.record_counts) : {};
            const date = new Date(b.created_at);
            return (
              <div
                key={b.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700">
                      {date.toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    <div className="text-gray-400 truncate">
                      {formatBytes(b.size_bytes)} ·{" "}
                      {Object.entries(counts)
                        .map(([k, v]) => `${v} ${k}`)
                        .join(", ")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${b.triggered_by === "manual" ? "border-blue-300 text-blue-600" : "border-gray-300 text-gray-500"}`}
                  >
                    {b.triggered_by}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => downloadBackup(b.id, b.created_at)}
                    title="Download backup"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlatformAdmin() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);

  const { data: companies, isLoading } = useQuery<CompanyWithModules[]>({
    queryKey: ["/api/platform/companies"],
  });

  const moduleMutation = useMutation({
    mutationFn: async ({
      companyId,
      moduleId,
      isEnabled,
    }: {
      companyId: number;
      moduleId: string;
      isEnabled: boolean;
    }) =>
      apiRequest("PATCH", `/api/platform/companies/${companyId}/modules/${moduleId}`, {
        isEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
      toast({ title: "Module updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update module", variant: "destructive" });
    },
  });

  const companyStatusMutation = useMutation({
    mutationFn: async ({ companyId, isActive }: { companyId: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/platform/companies/${companyId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/companies"] });
      toast({ title: "Company status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update company status", variant: "destructive" });
    },
  });

  const filtered = (companies ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      c.adminEmail?.toLowerCase().includes(search.toLowerCase()),
  );

  function getModuleEnabled(company: CompanyWithModules, moduleId: string): boolean {
    const entry = company.modules.find((m) => m.moduleId === moduleId);
    if (!entry) return moduleId === "keylocate";
    return entry.isEnabled;
  }

  function toggleModule(company: CompanyWithModules, moduleId: string) {
    const current = getModuleEnabled(company, moduleId);
    moduleMutation.mutate({ companyId: company.id, moduleId, isEnabled: !current });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Administration</h1>
        <p className="text-gray-500 mt-1">
          Manage all companies and control which modules they have access to.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{companies?.length ?? 0}</div>
            <div className="text-sm text-gray-500">Total Companies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {companies?.filter((c) => c.isActive).length ?? 0}
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">
              {companies?.reduce((acc, c) => {
                return acc + c.modules.filter((m) => m.isEnabled).length;
              }, 0) ?? 0}
            </div>
            <div className="text-sm text-gray-500">Module Activations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{PLATFORM_MODULES.length}</div>
            <div className="text-sm text-gray-500">Available Modules</div>
          </CardContent>
        </Card>
      </div>

      {/* Module legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Modules</CardTitle>
          <CardDescription>Toggle these per company below</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {PLATFORM_MODULES.map((mod) => {
              const Icon = MODULE_ICONS[mod.icon] ?? Key;
              return (
                <div
                  key={mod.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${MODULE_COLORS[mod.color]}`}
                >
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{mod.name}</div>
                    <div className="text-xs opacity-75 mt-0.5">{mod.description.slice(0, 60)}…</div>
                    {mod.comingSoon && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Coming soon
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Company list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading companies…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No companies found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((company) => {
            const isExpanded = expandedCompany === company.id;
            return (
              <Card key={company.id} className={!company.isActive ? "opacity-60" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{company.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {company.planType}
                        </Badge>
                        {!company.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {company.adminEmail ?? company.slug}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Quick module chips */}
                      <div className="hidden sm:flex gap-1">
                        {PLATFORM_MODULES.filter((m) => !m.comingSoon).map((mod) => (
                          <div
                            key={mod.id}
                            className={`w-2.5 h-2.5 rounded-full ${
                              getModuleEnabled(company, mod.id)
                                ? "bg-green-500"
                                : "bg-gray-200"
                            }`}
                            title={`${mod.name}: ${getModuleEnabled(company, mod.id) ? "enabled" : "disabled"}`}
                          />
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      {/* Account status toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-700">Account Active</div>
                          <div className="text-xs text-gray-500">
                            Inactive companies cannot log in
                          </div>
                        </div>
                        <Switch
                          checked={company.isActive ?? false}
                          onCheckedChange={(checked) =>
                            companyStatusMutation.mutate({
                              companyId: company.id,
                              isActive: checked,
                            })
                          }
                          disabled={companyStatusMutation.isPending}
                        />
                      </div>

                      <div className="border-t pt-3">
                        <div className="text-sm font-medium text-gray-700 mb-3">Module Access</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {PLATFORM_MODULES.map((mod) => {
                            const Icon = MODULE_ICONS[mod.icon] ?? Key;
                            const enabled = getModuleEnabled(company, mod.id);
                            return (
                              <div
                                key={mod.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${enabled ? "text-green-600" : "text-gray-400"}`} />
                                  <div>
                                    <div className="text-sm font-medium">{mod.name}</div>
                                    {mod.comingSoon && (
                                      <div className="text-xs text-gray-400">Coming soon</div>
                                    )}
                                  </div>
                                </div>
                                <Switch
                                  checked={enabled}
                                  onCheckedChange={() => toggleModule(company, mod.id)}
                                  disabled={moduleMutation.isPending || mod.comingSoon}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {!getModuleEnabled(company, "keylocate") && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>
                            keylocate is disabled. Users at this company won't see any key
                            management features.
                          </span>
                        </div>
                      )}

                      {/* Backup section */}
                      <BackupPanel companyId={company.id} companyName={company.name} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
