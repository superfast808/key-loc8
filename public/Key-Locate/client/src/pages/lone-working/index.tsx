import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck, Plus, Pencil, Trash2, UserCheck, Clock, MapPin,
  Phone, Bell, AlertTriangle, CheckCircle2, Loader2, Users, Briefcase,
  Calendar, LogIn, LogOut, ChevronDown, ChevronUp, ChevronsUpDown, Check,
  RefreshCw, Link2, XCircle, Info, BellOff,
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subMinutes, differenceInMinutes, isPast } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useLoneWorking } from "@/hooks/useLoneWorking";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LwJob {
  id: number; name: string; jobType: string; locationId: number | null;
  description: string | null; isActive: boolean;
  location?: { id: number; name: string } | null;
}
interface LwAssignment {
  id: number; userId: number; jobId: number; companyId: number; isActive: boolean;
  user?: { id: number; firstName: string; lastName: string; email: string } | null;
  job?: LwJob | null;
}
interface LwShift {
  id: number; userId: number | null; jobId: number; companyId: number;
  contactId?: number | null;
  scheduledStart: string; scheduledEnd: string;
  status: string; alertSent: boolean;
  deputySynced?: boolean; deputyShiftId?: number | null;
  user?: { id: number; firstName: string; lastName: string; email: string } | null;
  contact?: { id: number; name: string; phone: string } | null;
  job?: LwJob | null;
}
interface LwContact {
  id: number; userId: number | null; companyId: number; contactType: string;
  name: string; phone: string; email: string | null; isActive: boolean; alertEnabled: boolean;
  deputyEmployeeId: number | null;
}
interface LwCheckIn {
  id: number; userId: number; jobId: number; status: string;
  checkInTime: string; checkOutTime: string | null;
  checkInLat: string | null; checkInLng: string | null;
  user?: { id: number; firstName: string; lastName: string; email: string } | null;
  job?: LwJob | null;
}
interface User {
  id: number; firstName: string; lastName: string; email: string; role: string;
}
interface Location {
  id: number; name: string; locationType: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function userName(u: any) {
  if (!u) return "Unknown";
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Unknown";
}

function safeFormat(value: any, fmt: string, fallback = "—"): string {
  if (!value) return fallback;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    missed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    resolved: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    calling: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    sent: "bg-blue-100 text-blue-800",
    checked_in: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    checked_out: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoneWorkingAdmin() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: lwStatus, isLoading: lwLoading } = useLoneWorking();

  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  // If employee (not admin), redirect to check-in or active session
  useEffect(() => {
    if (!isAdmin && !lwLoading) {
      if (lwStatus?.activeCheckIn) {
        navigate("/lone-working/active");
      } else {
        navigate("/lone-working/check-in");
      }
    }
  }, [isAdmin, lwLoading, lwStatus?.activeCheckIn, navigate]);

  if (!isAdmin) return null;

  return <LoneWorkingAdminPanel />;
}

function LoneWorkingAdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Data queries
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<LwJob[]>({ queryKey: ["/api/lw/jobs"] });
  const { data: shifts = [] } = useQuery<LwShift[]>({ queryKey: ["/api/lw/shifts"] });
  const { data: contacts = [] } = useQuery<LwContact[]>({ queryKey: ["/api/lw/contacts"] });
  const { data: checkIns = [] } = useQuery<LwCheckIn[]>({ queryKey: ["/api/lw/check-ins"] });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  // Active check-ins for live overview
  const activeCheckIns = checkIns.filter(c => c.status === "checked_in");

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Lone Working</h1>
          <p className="text-sm text-muted-foreground">Manage locations, shifts, people and welfare alerts</p>
        </div>
      </div>

      {/* Live overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={<UserCheck className="w-5 h-5 text-green-600" />} label="Checked In" value={activeCheckIns.length} color="green" />
        <StatCard icon={<Briefcase className="w-5 h-5 text-blue-600" />} label="Active Locations" value={jobs.filter(j => j.isActive).length} color="blue" />
        <StatCard icon={<Calendar className="w-5 h-5 text-purple-600" />} label="Shifts Today" value={shifts.filter(s => {
          const d = new Date(s.scheduledStart);
          const today = new Date();
          return d.toDateString() === today.toDateString();
        }).length} color="purple" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Live Overview</TabsTrigger>
          <TabsTrigger value="my-shifts">My Shifts</TabsTrigger>
          <TabsTrigger value="jobs">Locations</TabsTrigger>
          <TabsTrigger value="shifts">All Shifts</TabsTrigger>
          <TabsTrigger value="contacts">People</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="deputy">
            <Link2 className="w-3.5 h-3.5 mr-1.5" />Deputy Sync
          </TabsTrigger>
        </TabsList>

        {/* ── LIVE OVERVIEW ─────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Currently checked in</h2>
          {activeCheckIns.length === 0 ? (
            <EmptyState icon={<UserCheck className="w-8 h-8" />} message="No one is currently checked in" />
          ) : (
            <div className="space-y-2">
              {activeCheckIns.map(c => (
                <Card key={c.id}>
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{userName(c.user)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.job?.name} · checked in {safeFormat(c.checkInTime, "HH:mm")}
                        </p>
                        {c.checkInLat && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {parseFloat(c.checkInLat).toFixed(4)}, {parseFloat(c.checkInLng!).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                    {statusBadge(c.status)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

        </TabsContent>

        {/* ── MY SHIFTS ────────────────────────────────────────── */}
        <TabsContent value="my-shifts" className="mt-4">
          <MyShiftsPanel queryClient={queryClient} toast={toast} />
        </TabsContent>

        {/* ── JOBS ──────────────────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-4">
          <JobsPanel jobs={jobs} locations={locations as Location[]} queryClient={queryClient} toast={toast} />
        </TabsContent>

        {/* ── SHIFTS ────────────────────────────────────────────── */}
        <TabsContent value="shifts" className="mt-4">
          <ShiftsPanel shifts={shifts} jobs={jobs} users={users} queryClient={queryClient} toast={toast} />
        </TabsContent>

        {/* ── CONTACTS ──────────────────────────────────────────── */}
        <TabsContent value="contacts" className="mt-4">
          <ContactsPanel contacts={contacts} users={users} queryClient={queryClient} toast={toast} />
        </TabsContent>

        {/* ── HISTORY ───────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <HistoryPanel checkIns={checkIns} />
        </TabsContent>

        {/* ── DEPUTY SYNC ───────────────────────────────────────── */}
        <TabsContent value="deputy" className="mt-4">
          <DeputySyncPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const bg: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  };
  return (
    <Card className={`${bg[color]} border`}>
      <CardContent className="pt-4 pb-4 text-center">
        <div className="flex justify-center mb-2">{icon}</div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="flex justify-center mb-3 opacity-30">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Jobs Panel ──────────────────────────────────────────────────────────────

function JobsPanel({ jobs, locations, queryClient, toast }: {
  jobs: LwJob[]; locations: Location[]; queryClient: any; toast: any;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LwJob | null>(null);
  const [form, setForm] = useState({ name: "", jobType: "mobile", locationId: "", description: "" });
  const [locationSearch, setLocationSearch] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  const reset = () => {
    setForm({ name: "", jobType: "mobile", locationId: "", description: "" });
    setEditing(null);
    setLocationSearch("");
  };

  const mutation = useMutation({
    mutationFn: (data: any) => editing
      ? apiRequest("PATCH", `/api/lw/jobs/${editing.id}`, data)
      : apiRequest("POST", "/api/lw/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/jobs"] });
      toast({ title: editing ? "Location updated" : "Location created" });
      setOpen(false); reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lw/jobs/${id}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/lw/jobs"] }); toast({ title: "Location removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (job: LwJob) => {
    setEditing(job);
    setForm({ name: job.name, jobType: job.jobType, locationId: job.locationId ? String(job.locationId) : "", description: job.description || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    mutation.mutate({
      name: form.name,
      jobType: form.jobType,
      locationId: form.locationId ? parseInt(form.locationId) : null,
      description: form.description || null,
    });
  };

  const selectedLocationId = form.locationId ? parseInt(form.locationId) : null;
  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{jobs.filter(j => j.isActive).length} active locations</p>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />New Location
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="w-8 h-8" />} message="No locations yet. Locations sync from Deputy automatically, or add one manually." />
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            return (
              <Card key={job.id} className={!job.isActive ? "opacity-50" : ""}>
                <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{job.name}</span>
                      <Badge variant={job.jobType === "static" ? "default" : "outline"} className="text-xs capitalize">{job.jobType}</Badge>
                      {!job.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                    {job.location && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{job.location.name}
                      </p>
                    )}
                    {job.description && <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(job)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove location?</AlertDialogTitle>
                          <AlertDialogDescription>This will deactivate the job. Existing check-ins are preserved.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(job.id)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "New Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Job name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Night Security Round" />
            </div>

            <div className="space-y-1.5">
              <Label>Job type</Label>
              <Select
                value={form.jobType}
                onValueChange={v => setForm(p => ({ ...p, jobType: v, locationId: v === "mobile" ? "" : p.locationId }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile — worker moves between multiple locations</SelectItem>
                  <SelectItem value="static">Static — worker is based at a fixed location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.jobType === "static" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Linked location</Label>
                  {/* Searchable location combobox */}
                  <Popover open={locationPickerOpen} onOpenChange={setLocationPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {selectedLocation ? selectedLocation.name : "Search and select a location…"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                      <Command>
                        <CommandInput
                          placeholder="Search locations…"
                          value={locationSearch}
                          onValueChange={setLocationSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No location found.</CommandEmpty>
                          <CommandGroup>
                            {form.locationId && (
                              <CommandItem
                                value="__clear__"
                                onSelect={() => {
                                  setForm(p => ({ ...p, locationId: "" }));
                                  setLocationSearch("");
                                  setLocationPickerOpen(false);
                                }}
                              >
                                <span className="text-muted-foreground italic">Clear selection</span>
                              </CommandItem>
                            )}
                            {filteredLocations.map(l => (
                              <CommandItem
                                key={l.id}
                                value={l.name}
                                onSelect={() => {
                                  setForm(p => ({ ...p, locationId: String(l.id) }));
                                  setLocationSearch("");
                                  setLocationPickerOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${form.locationId === String(l.id) ? "opacity-100" : "opacity-0"}`} />
                                <span>{l.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

              </div>
            )}

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes about this job" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {editing ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Assignments Panel ────────────────────────────────────────────────────────

function AssignmentsPanel({ assignments, jobs, users, queryClient, toast }: {
  assignments: LwAssignment[]; jobs: LwJob[]; users: User[]; queryClient: any; toast: any;
}) {
  // addJobForUser: which user's "add job" popover is open
  const [addJobUserId, setAddJobUserId] = useState<number | null>(null);
  const [addJobId, setAddJobId] = useState("");
  // addNewWorker dialog
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [newWorkerForm, setNewWorkerForm] = useState({ userId: "", jobId: "" });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lw/assignments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/assignments"] });
      toast({ title: "Job assigned" });
      setAddJobUserId(null);
      setAddJobId("");
      setWorkerDialogOpen(false);
      setNewWorkerForm({ userId: "", jobId: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/lw/assignments/${id}`, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/assignments"] });
      toast({ title: "Assignment removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group active assignments by user
  const activeAssignments = assignments.filter(a => a.isActive);
  const grouped = users
    .map(u => ({
      user: u,
      assignments: activeAssignments.filter(a => a.userId === u.id),
    }))
    .filter(g => g.assignments.length > 0);

  // Users not yet assigned to anything
  const unassignedUsers = users.filter(u => !activeAssignments.some(a => a.userId === u.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {grouped.length} worker{grouped.length !== 1 ? "s" : ""} · {activeAssignments.length} job assignment{activeAssignments.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setWorkerDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />Add Worker
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} message="No assignments yet. Add workers and assign them to jobs." />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ user, assignments: userAssignments }) => {
            // Jobs already assigned to this user (to exclude from add-job dropdown)
            const assignedJobIds = new Set(userAssignments.map(a => a.jobId));
            const availableJobs = jobs.filter(j => j.isActive && !assignedJobIds.has(j.id));
            const isAddingJob = addJobUserId === user.id;

            return (
              <Card key={user.id}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Employee header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {(user.firstName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{userName(user)}</p>
                        <p className="text-xs text-muted-foreground">{(user as any).email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {userAssignments.length} job{userAssignments.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Job tags */}
                  <div className="flex flex-wrap gap-2">
                    {userAssignments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs font-medium"
                      >
                        <Briefcase className="w-3 h-3 text-muted-foreground" />
                        <span>{a.job?.name}</span>
                        <span className="text-muted-foreground capitalize">· {a.job?.jobType}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="ml-1 text-muted-foreground hover:text-destructive transition-colors rounded-full">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this assignment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {userName(user)} will no longer be assigned to <strong>{a.job?.name}</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMutation.mutate(a.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}

                    {/* Inline add job */}
                    {availableJobs.length > 0 && !isAddingJob && (
                      <button
                        onClick={() => { setAddJobUserId(user.id); setAddJobId(""); }}
                        className="flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />Add job
                      </button>
                    )}
                  </div>

                  {/* Inline job selector */}
                  {isAddingJob && (
                    <div className="flex items-center gap-2 pt-1">
                      <Select value={addJobId} onValueChange={setAddJobId}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Select job to add…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableJobs.map(j => (
                            <SelectItem key={j.id} value={String(j.id)}>
                              {j.name} <span className="text-muted-foreground capitalize">· {j.jobType}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!addJobId || createMutation.isPending}
                        onClick={() => createMutation.mutate({ userId: user.id, jobId: parseInt(addJobId) })}
                      >
                        {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => { setAddJobUserId(null); setAddJobId(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add new worker dialog */}
      <Dialog open={workerDialogOpen} onOpenChange={v => { setWorkerDialogOpen(v); setNewWorkerForm({ userId: "", jobId: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Worker to Lone Working</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Worker</Label>
              <Select value={newWorkerForm.userId} onValueChange={v => setNewWorkerForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select worker…" /></SelectTrigger>
                <SelectContent>
                  {(unassignedUsers.length > 0 ? unassignedUsers : users).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{userName(u)} — {(u as any).email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unassignedUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">All workers already have assignments. You can add more jobs to existing workers above.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>First job to assign</Label>
              <Select value={newWorkerForm.jobId} onValueChange={v => setNewWorkerForm(p => ({ ...p, jobId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select job…" /></SelectTrigger>
                <SelectContent>
                  {jobs.filter(j => j.isActive).map(j => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.name} — <span className="capitalize">{j.jobType}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkerDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ userId: parseInt(newWorkerForm.userId), jobId: parseInt(newWorkerForm.jobId) })}
              disabled={createMutation.isPending || !newWorkerForm.userId || !newWorkerForm.jobId}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Add & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── My Shifts Panel (for admins who are also workers) ───────────────────────

function MyShiftsPanel({ queryClient, toast }: { queryClient: any; toast: any }) {
  const [, navigate] = useLocation();
  const { data: myShifts = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/lw/my-shifts"] });
  const { data: lwStatus } = useLoneWorking();

  const checkOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/lw/check-out", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lw/my-shifts"] });
      toast({ title: "Checked out" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const now = new Date();
  const byShiftTime = (a: any, b: any) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
  const signableShifts = myShifts.filter(s => {
    const start = new Date(s.scheduledStart);
    const end = new Date(s.scheduledEnd);
    return now >= subMinutes(start, 30) && now <= end && s.status !== "active" && s.status !== "completed";
  }).sort(byShiftTime);
  const upcomingShifts = myShifts.filter(s => new Date(s.scheduledStart) > new Date() && now < subMinutes(new Date(s.scheduledStart), 30)).sort(byShiftTime);
  const active = lwStatus?.activeCheckIn;

  return (
    <div className="space-y-4">
      {/* Active check-in banner */}
      {active && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">You're checked in</p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Since {safeFormat(active.checkInTime, "HH:mm")}
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                  <LogOut className="w-4 h-4 mr-1.5" />Check Out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Check out?</AlertDialogTitle>
                  <AlertDialogDescription>This will end your active lone working session.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => checkOutMutation.mutate()} className="bg-destructive text-destructive-foreground">
                    Check Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Signable shifts */}
      {signableShifts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ready to sign on</h3>
          {signableShifts.map((s: any) => (
            <Card key={s.id} className="border-green-300 dark:border-green-700">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">{s.job?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {safeFormat(s.scheduledStart, "dd MMM HH:mm")} – {safeFormat(s.scheduledEnd, "HH:mm")}
                  </p>
                </div>
                {!active && (
                  <Button size="sm" className="w-full" onClick={() => navigate("/lone-working/check-in")}>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />Sign On to This Shift
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upcoming shifts */}
      {upcomingShifts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h3>
          {upcomingShifts.map((s: any) => {
            const minsUntil = differenceInMinutes(subMinutes(new Date(s.scheduledStart), 30), now);
            const timeLabel = minsUntil > 1440
              ? `Sign-on opens ${format(subMinutes(new Date(s.scheduledStart), 30), "EEE dd MMM HH:mm")}`
              : minsUntil > 60
                ? `Sign-on opens in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`
                : `Sign-on opens in ${minsUntil}m`;
            return (
              <Card key={s.id}>
                <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{s.job?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {safeFormat(s.scheduledStart, "EEE dd MMM, HH:mm")} – {safeFormat(s.scheduledEnd, "HH:mm")}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{timeLabel}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">Scheduled</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!active && signableShifts.length === 0 && upcomingShifts.length === 0 && (
        <EmptyState icon={<Calendar className="w-8 h-8" />} message="No shifts scheduled for you. Ask your admin to schedule you a shift." />
      )}

      {!active && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/lone-working/check-in")}>
          <LogIn className="w-4 h-4 mr-1.5" />Ad-hoc Check In
        </Button>
      )}
    </div>
  );
}

// ─── Shifts Panel ─────────────────────────────────────────────────────────────

function ShiftsPanel({ shifts, jobs, users, queryClient, toast }: {
  shifts: LwShift[]; jobs: LwJob[]; users: User[]; queryClient: any; toast: any;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    userId: "", jobId: "", scheduledStart: "", scheduledEnd: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lw/shifts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lw/my-shifts"] });
      toast({ title: "Shift created" });
      setOpen(false); setForm({ userId: "", jobId: "", scheduledStart: "", scheduledEnd: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lw/shifts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lw/my-shifts"] });
      toast({ title: "Shift removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const byTime = (a: LwShift, b: LwShift) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
  const byTimeDesc = (a: LwShift, b: LwShift) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const today = shifts.filter(s => { const d = new Date(s.scheduledStart); return d >= todayStart && d <= todayEnd; }).sort(byTime);
  const upcoming = shifts.filter(s => new Date(s.scheduledStart) > todayEnd).sort(byTime);
  const past = shifts.filter(s => new Date(s.scheduledStart) < todayStart).sort(byTimeDesc);

  const renderShift = (s: LwShift) => {
    const workerName = s.user ? userName(s.user) : s.contact?.name || "Unknown Employee";
    return (
    <Card key={s.id} className={s.status === "missed" ? "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10" : ""}>
      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{workerName}</p>
            {!s.user && s.contact && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">No login</span>
            )}
            {statusBadge(s.status)}
            {s.alertSent && <Badge variant="destructive" className="text-xs">Alert sent</Badge>}
            {(s as any).deputySynced && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Link2 className="w-3 h-3" />Deputy
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{s.job?.name}</p>
          <p className="text-xs text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            {safeFormat(s.scheduledStart, "dd MMM HH:mm")} – {safeFormat(s.scheduledEnd, "HH:mm")}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the {s.status === "missed" ? "missed " : ""}shift for {workerName} on {safeFormat(s.scheduledStart, "EEE dd MMM, HH:mm")}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(s.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Delete shift
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{today.length} today · {upcoming.length} upcoming · {past.length} past</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />Schedule Shift
        </Button>
      </div>

      {shifts.length === 0 ? (
        <EmptyState icon={<Calendar className="w-8 h-8" />} message="No shifts scheduled yet." />
      ) : (
        <div className="space-y-4">
          {today.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today</h3>
              <div className="space-y-2">{today.map(renderShift)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</h3>
              <div className="space-y-2">{upcoming.slice(0, 20).map(renderShift)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Past / Missed</h3>
              <div className="space-y-2">{past.slice(0, 30).map(renderShift)}</div>
            </div>
          )}
          {today.length === 0 && upcoming.length === 0 && past.length === 0 && (
            <EmptyState icon={<Calendar className="w-8 h-8" />} message="No shifts found." />
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Schedule Shift</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Worker</Label>
              <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select worker…" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{userName(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Job</Label>
              <Select value={form.jobId} onValueChange={v => setForm(p => ({ ...p, jobId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select job…" /></SelectTrigger>
                <SelectContent>
                  {jobs.filter(j => j.isActive).map(j => <SelectItem key={j.id} value={String(j.id)}>{j.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="datetime-local" value={form.scheduledStart} onChange={e => setForm(p => ({ ...p, scheduledStart: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="datetime-local" value={form.scheduledEnd} onChange={e => setForm(p => ({ ...p, scheduledEnd: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({
                userId: parseInt(form.userId), jobId: parseInt(form.jobId),
                scheduledStart: new Date(form.scheduledStart).toISOString(),
                scheduledEnd: new Date(form.scheduledEnd).toISOString(),
              })}
              disabled={mutation.isPending || !form.userId || !form.jobId || !form.scheduledStart || !form.scheduledEnd}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Contacts Panel ───────────────────────────────────────────────────────────

function ContactsPanel({ contacts, users, queryClient, toast }: {
  contacts: LwContact[]; users: User[]; queryClient: any; toast: any;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ contactType: "manager", name: "", phone: "", email: "" });
  const [testingId, setTestingId] = useState<number | null>(null);
  const [editContact, setEditContact] = useState<LwContact | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", contactType: "employee" });
  const [createLoginContact, setCreateLoginContact] = useState<LwContact | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", role: "officer" });
  const [createdCreds, setCreatedCreds] = useState<{ name: string; email: string; password: string } | null>(null);

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/lw/contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/contacts"] });
      toast({ title: "Contact added" });
      setAddOpen(false);
      setForm({ contactType: "manager", name: "", phone: "", email: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/lw/contacts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/contacts"] });
      toast({ title: "Contact removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testCallMutation = useMutation({
    mutationFn: ({ phone, name }: { phone: string; name: string }) =>
      apiRequest("POST", "/api/lw/test-call", { phone, name }),
    onSuccess: (_data: any, vars: any) => {
      toast({ title: "Test call placed", description: `Calling ${vars.phone} now.` });
      setTestingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Call failed", description: e.message, variant: "destructive" });
      setTestingId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/lw/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/contacts"] });
      toast({ title: "Contact updated" });
      setEditContact(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, alertEnabled }: { id: number; alertEnabled: boolean }) =>
      apiRequest("PATCH", `/api/lw/contacts/${id}`, { alertEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/lw/contacts"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLoginMutation = useMutation({
    mutationFn: ({ id, email, role }: { id: number; email: string; role: string }) =>
      apiRequest("POST", `/api/lw/contacts/${id}/create-login`, { email, role }),
    onSuccess: (data: any, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lw/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreatedCreds({ name: createLoginContact!.name, email: vars.email, password: data.temporaryPassword });
      setCreateLoginContact(null);
      setLoginForm({ email: "", role: "officer" });
    },
    onError: (e: any) => toast({ title: "Login creation failed", description: e.message, variant: "destructive" }),
  });

  const byName = (a: LwContact, b: LwContact) => a.name.localeCompare(b.name);
  const employees = contacts.filter(c => c.contactType === "employee").sort(byName);
  const managers = contacts.filter(c => c.contactType === "manager").sort(byName);
  const callReceivers = contacts.filter(c => c.contactType === "call_receiver_manager").sort(byName);
  const emergency = contacts.filter(c => c.contactType === "emergency").sort(byName);

  const renderContactCard = (c: LwContact) => {
    const hasLogin = c.userId != null;
    const initials = c.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <Card key={c.id} className={!c.isActive ? "opacity-60" : ""}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{initials || "?"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{c.name}</p>
                  {hasLogin ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <Check className="w-3 h-3" />Has login
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      No login
                    </span>
                  )}
                  {c.deputyEmployeeId && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      <Link2 className="w-3 h-3" />Deputy
                    </span>
                  )}
                  {!c.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                </div>
                {c.phone
                  ? <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.phone}</p>
                  : <p className="text-xs text-muted-foreground/60 italic mt-0.5">No phone — tap edit to add</p>
                }
                {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                {hasLogin && (() => {
                  const worker = users.find(u => u.id === c.userId);
                  return worker ? (
                    <p className="text-xs text-muted-foreground">Login: {(worker as any).email}</p>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!hasLogin && c.contactType === "employee" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={() => { setCreateLoginContact(c); setLoginForm({ email: c.email || "", role: "officer" }); }}
                >
                  <LogIn className="w-3 h-3" />Create login
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => { setEditContact(c); setEditForm({ name: c.name, phone: c.phone || "", email: c.email || "", contactType: c.contactType }); }}
              >
                <Pencil className="w-3 h-3" />
              </Button>
              {c.phone && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={testingId === c.id} onClick={() => setTestingId(c.id)}>
                      {testingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Test call to {c.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will immediately call <strong>{c.phone}</strong> with a test message to verify Twilio is configured correctly.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setTestingId(null)}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => testCallMutation.mutate({ phone: c.phone, name: c.name })}>
                        <Phone className="w-3.5 h-3.5 mr-1.5" />Call now
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
                    <AlertDialogDescription>They will be removed from the People directory. This does not affect their keylocate login or Deputy records.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              {c.alertEnabled !== false ? (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <Bell className="w-3 h-3" />Alerts on
                </span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BellOff className="w-3 h-3" />Alerts off — missed check-ins ignored
                </span>
              )}
            </div>
            <Switch
              checked={c.alertEnabled !== false}
              onCheckedChange={checked => toggleAlertMutation.mutate({ id: c.id, alertEnabled: checked })}
              disabled={toggleAlertMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {contacts.length} people · {contacts.filter(c => c.userId).length} with logins
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />Add manually
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <CardContent className="pt-4 pb-4 flex gap-2 text-sm text-blue-800 dark:text-blue-200">
          <Users className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Employees sync from Deputy. <strong>Call receiver managers</strong> are the only contacts automatically called when a lone worker misses their check-in (along with the employee themselves).
            Employees with a <strong>keylocate login</strong> can check in themselves — use <strong>Create login</strong> to give them access.
          </span>
        </CardContent>
      </Card>

      {contacts.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} message="No people yet. Run a Deputy sync to import employees automatically." />
      ) : (
        <div className="space-y-6">
          {employees.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Employees ({employees.length})
              </h3>
              <div className="space-y-2">{employees.map(renderContactCard)}</div>
            </div>
          )}
          {callReceivers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />Call receiver managers ({callReceivers.length}) · Called on missed check-in
              </h3>
              <div className="space-y-2">{callReceivers.map(renderContactCard)}</div>
            </div>
          )}
          {managers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Managers ({managers.length})
              </h3>
              <div className="space-y-2">{managers.map(renderContactCard)}</div>
            </div>
          )}
          {emergency.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Emergency ({emergency.length})
              </h3>
              <div className="space-y-2">{emergency.map(renderContactCard)}</div>
            </div>
          )}
        </div>
      )}

      {/* Add person dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Person Manually</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.contactType} onValueChange={v => setForm(p => ({ ...p, contactType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee (lone worker)</SelectItem>
                  <SelectItem value="call_receiver_manager">Call receiver manager (called on missed check-in)</SelectItem>
                  <SelectItem value="manager">Manager / supervisor</SelectItem>
                  <SelectItem value="emergency">Emergency contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (E.164 format, e.g. +447911123456)</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+447911123456" />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email" placeholder="jane@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate({
                contactType: form.contactType,
                name: form.name,
                phone: form.phone,
                email: form.email || null,
              })}
              disabled={addMutation.isPending || !form.name.trim()}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit contact dialog */}
      <Dialog open={!!editContact} onOpenChange={open => { if (!open) setEditContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editContact?.deputyEmployeeId && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="pt-3 pb-3 flex gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>This person syncs from Deputy. Name changes here will be overwritten on the next sync. Phone, email and role changes will <strong>not</strong> be overwritten.</span>
                </CardContent>
              </Card>
            )}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editForm.contactType} onValueChange={v => setEditForm(p => ({ ...p, contactType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee (lone worker)</SelectItem>
                  <SelectItem value="call_receiver_manager">Call receiver manager (called on missed check-in)</SelectItem>
                  <SelectItem value="manager">Manager / supervisor</SelectItem>
                  <SelectItem value="emergency">Emergency contact</SelectItem>
                </SelectContent>
              </Select>
              {editForm.contactType === "call_receiver_manager" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" />This person will be called automatically when a lone worker misses their check-in.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone number (E.164 format, e.g. +447911123456)</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="+447911123456" />
              {editForm.contactType === "call_receiver_manager"
                ? <p className="text-xs text-amber-600 dark:text-amber-400">Required — this number will be called for missed check-in alerts.</p>
                : <p className="text-xs text-muted-foreground">Used for Twilio alert calls (call receiver managers only).</p>
              }
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} type="email" placeholder="name@company.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editContact!.id, data: { name: editForm.name, phone: editForm.phone, email: editForm.email || null, contactType: editForm.contactType } })}
              disabled={updateMutation.isPending || !editForm.name.trim()}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create login dialog */}
      <Dialog open={!!createLoginContact} onOpenChange={open => { if (!open) setCreateLoginContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create keylocate login for {createLoginContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will create a new keylocate account so <strong>{createLoginContact?.name}</strong> can log in and check in for their shifts.
            </p>
            <div className="space-y-1.5">
              <Label>Email address *</Label>
              <Input
                value={loginForm.email}
                onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                type="email"
                placeholder="employee@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={loginForm.role} onValueChange={v => setLoginForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="officer">Officer (employee, check-in only)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">A temporary password will be generated. Share it securely with the employee — they can change it after first login.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateLoginContact(null)}>Cancel</Button>
            <Button
              onClick={() => createLoginMutation.mutate({ id: createLoginContact!.id, email: loginForm.email, role: loginForm.role })}
              disabled={createLoginMutation.isPending || !loginForm.email.trim()}
            >
              {createLoginMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Create login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created credentials dialog */}
      <Dialog open={!!createdCreds} onOpenChange={open => { if (!open) setCreatedCreds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Login created for {createdCreds?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm font-medium">{createdCreds?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temporary password</p>
                  <p className="font-mono text-sm font-medium bg-background rounded px-2 py-1 border">{createdCreds?.password}</p>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Share these credentials securely with the employee. They should change their password after first login via their profile page.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Deputy Sync Panel ────────────────────────────────────────────────────────

interface DeputySyncResult {
  synced: number;
  alreadySynced: number;
  noLocation: number;
  errors: string[];
  notConfigured?: boolean;
  tokenInvalid?: boolean;
  peopleAdded?: number;
  peopleUpdated?: number;
  locationsAdded?: number;
  locationsUpdated?: number;
}

function DeputySyncPanel() {
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<DeputySyncResult | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/deputy/sync", {}),
    onSuccess: async (data: DeputySyncResult) => {
      setLastResult(data);
      if (data.tokenInvalid) {
        toast({ title: "Deputy token rejected", description: "The API token was refused by Deputy (401). Please generate a new Permanent Access Token in Deputy and update it.", variant: "destructive" });
      } else if (data.synced > 0 || (data.peopleAdded ?? 0) > 0 || (data.locationsAdded ?? 0) > 0) {
        const parts = [];
        if ((data.peopleAdded ?? 0) > 0) parts.push(`${data.peopleAdded} people added`);
        if ((data.locationsAdded ?? 0) > 0) parts.push(`${data.locationsAdded} locations added`);
        if (data.synced > 0) parts.push(`${data.synced} shifts synced`);
        toast({ title: "Deputy sync complete", description: parts.join(", ") });
      } else {
        toast({ title: "Deputy sync complete", description: "Everything is already up to date." });
      }
    },
    onError: (e: any) => {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    },
  });

  const tokenInvalid = lastResult?.tokenInvalid;

  return (
    <div className="space-y-6">
      {/* Token error banner */}
      {tokenInvalid && (
        <Card className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-red-900 dark:text-red-200">Deputy API token rejected (401)</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  The token saved in your environment was refused by Deputy. To fix this:<br />
                  1. Log in to Deputy → Settings → API → Permanent Access Tokens<br />
                  2. Generate a new token<br />
                  3. Update the <code className="font-mono bg-red-100 dark:bg-red-900/30 px-1 rounded">DEPUTY_API_TOKEN</code> secret and restart the app
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header info */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm text-blue-900 dark:text-blue-200">Deputy Integration — syncs every 15 minutes</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Three layers sync automatically: Deputy employees → People, Deputy areas → Locations, and Deputy roster → Shifts (looking 7 days ahead). All syncs are idempotent — safe to run as many times as needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How matching works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            How name matching works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-foreground">People</p>
              <p>Every Deputy employee is added directly to People. Names, phone numbers, and emails are kept up to date automatically on every sync.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Locations</p>
              <p>Every Deputy operational unit is created as a Location. If the name changes in Deputy it will update here on the next sync.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">Shifts</p>
              <p>Roster shifts are matched to locations by Deputy area ID (exact), and to keylocate users by first + last name. Only keylocate users can receive shift allocations.</p>
            </div>
          </div>
          <p className="text-xs border-t pt-3">
            All syncs are idempotent — Deputy IDs are tracked so nothing is duplicated across runs.
          </p>
        </CardContent>
      </Card>

      {/* Manual sync */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Manual sync</CardTitle>
          <CardDescription>Run a sync now — useful after updating jobs or adding new users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-2"
          >
            {syncMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Syncing…</>
              : <><RefreshCw className="w-4 h-4" />Sync now</>
            }
          </Button>

          {lastResult && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-medium text-sm">Last sync result</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {((lastResult.peopleAdded ?? 0) > 0 || (lastResult.peopleUpdated ?? 0) > 0) && (
                  <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                    <Users className="w-4 h-4" />
                    {lastResult.peopleAdded} people added, {lastResult.peopleUpdated} updated
                  </span>
                )}
                {((lastResult.locationsAdded ?? 0) > 0 || (lastResult.locationsUpdated ?? 0) > 0) && (
                  <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                    <MapPin className="w-4 h-4" />
                    {lastResult.locationsAdded} locations added, {lastResult.locationsUpdated} updated
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {lastResult.synced} new shifts imported
                </span>
                {lastResult.alreadySynced > 0 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {lastResult.alreadySynced} already in sync
                  </span>
                )}
                {lastResult.noLocation > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <MapPin className="w-4 h-4" />
                    {lastResult.noLocation} no location match
                  </span>
                )}
                {lastResult.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-4 h-4" />
                    {lastResult.errors.length} unmatched
                  </span>
                )}
              </div>

              {lastResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Unmatched shifts (no action needed if employees/areas aren't in keylocate):</p>
                  <div className="rounded bg-orange-50 dark:bg-orange-900/20 p-2 space-y-0.5 max-h-48 overflow-y-auto">
                    {[...new Set(lastResult.errors)].map((e, i) => (
                      <p key={i} className="text-xs text-orange-800 dark:text-orange-300">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tips for better matching</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p>People and Locations are created automatically — you don't need to do anything for them to appear.</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p>For shifts to be allocated, the employee in Deputy must have a matching keylocate login with the same first and last name.</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p>Any new people or locations added to Deputy will appear here automatically on the next sync (within 15 minutes).</p>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p>Shifts deleted in keylocate will not be removed from Deputy. Manage your roster in Deputy and it will reflect here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({ checkIns }: { checkIns: LwCheckIn[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{checkIns.length} check-in records</p>
      {checkIns.length === 0 ? (
        <EmptyState icon={<Clock className="w-8 h-8" />} message="No check-in history yet." />
      ) : (
        <div className="space-y-2">
          {checkIns.slice(0, 50).map(c => (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    c.status === "checked_in" ? "bg-green-100 dark:bg-green-800" : "bg-gray-100 dark:bg-gray-800"
                  }`}>
                    {c.status === "checked_in"
                      ? <LogIn className="w-4 h-4 text-green-600" />
                      : <LogOut className="w-4 h-4 text-gray-500" />
                    }
                  </div>
                  <div>
                    <p className="font-medium text-sm">{userName(c.user)}</p>
                    <p className="text-xs text-muted-foreground">{c.job?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      In: {safeFormat(c.checkInTime, "dd MMM HH:mm")}
                      {c.checkOutTime && ` · Out: ${safeFormat(c.checkOutTime, "HH:mm")}`}
                    </p>
                  </div>
                </div>
                {statusBadge(c.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
