import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Lock, Users,
  MapPin, Settings, Eye, UserPlus, Copy, CheckCircle, ExternalLink
} from "lucide-react";

const SECTION_TYPES = [
  { value: "heading", label: "Section Heading" },
  { value: "text_input", label: "Short Text Field" },
  { value: "textarea", label: "Long Text Area" },
  { value: "dropdown", label: "Dropdown Selection" },
  { value: "image", label: "Image Upload" },
  { value: "divider", label: "Divider Line" },
];

function SectionTypeLabel({ type }: { type: string }) {
  const t = SECTION_TYPES.find(x => x.value === type);
  const colors: Record<string, string> = {
    heading: "bg-purple-100 text-purple-700",
    text_input: "bg-blue-100 text-blue-700",
    textarea: "bg-blue-100 text-blue-700",
    dropdown: "bg-green-100 text-green-700",
    image: "bg-orange-100 text-orange-700",
    divider: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] ?? "bg-gray-100 text-gray-600"}`}>
      {t?.label ?? type}
    </span>
  );
}

export default function AssignmentBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  // Template section state
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [sectionForm, setSectionForm] = useState({ type: "text_input", label: "", options: "", required: false });

  // Customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ email: "", name: "", selectedBunches: [] as {identifier: string; address: string}[] });
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [bunchSearch, setBunchSearch] = useState("");
  const [locationsSearch, setLocationsSearch] = useState("");
  const [copiedInvite, setCopiedInvite] = useState<number | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<any[]>({
    queryKey: ["/api/assignments/template"],
  });

  // Key bunches deduped by identifier+address — what appears in the Locations tab
  const { data: keyBunches = [], isLoading: keyBunchesLoading } = useQuery<{ identifier: string; address: string }[]>({
    queryKey: ["/api/assignments/keybunches"],
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/assignments/customers"],
    enabled: isAdmin,
  });

  const { data: passwordCheck } = useQuery<{ hasPassword: boolean }>({
    queryKey: ["/api/assignments/access-password/check"],
    enabled: isAdmin,
  });

  function invalidateTemplate() {
    queryClient.invalidateQueries({ queryKey: ["/api/assignments/template"] });
    queryClient.invalidateQueries({ queryKey: ["/api/assignments/keybunch"] });
  }

  const addSectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assignments/template", data),
    onSuccess: () => {
      invalidateTemplate();
      toast({ title: "Section added" });
      setShowAddSection(false);
      setSectionForm({ type: "text_input", label: "", options: "", required: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/assignments/template/${id}`, data),
    onSuccess: () => {
      invalidateTemplate();
      toast({ title: "Section updated" });
      setEditingSection(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assignments/template/${id}`, {}),
    onSuccess: () => {
      invalidateTemplate();
      toast({ title: "Section removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const moveSectionMutation = useMutation({
    mutationFn: (orderedIds: number[]) => apiRequest("POST", "/api/assignments/template/reorder", { orderedIds }),
    onSuccess: () => invalidateTemplate(),
  });

  const addCustomerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assignments/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/customers"] });
      toast({ title: "Customer created", description: "Share the invite link so they can set their password." });
      setShowAddCustomer(false);
      setCustomerForm({ email: "", name: "", selectedBunches: [] });
      setBunchSearch("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/assignments/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/customers"] });
      toast({ title: "Customer updated" });
      setEditingCustomer(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assignments/customers/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/customers"] });
      toast({ title: "Customer removed" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: (password: string) => apiRequest("POST", "/api/assignments/access-password/set", { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/access-password/check"] });
      toast({ title: "Access password updated" });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function moveSection(index: number, direction: "up" | "down") {
    const newOrder = [...sections];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    moveSectionMutation.mutate(newOrder.map((s: any) => s.id));
  }

  function openEdit(section: any) {
    setEditingSection(section);
    setSectionForm({
      type: section.type,
      label: section.label,
      options: (section.options ?? []).join("\n"),
      required: section.required,
    });
  }

  function getInviteLink(customer: any) {
    return `${window.location.origin}/customer-portal/invite/${customer.inviteToken}`;
  }

  function copyInviteLink(customer: any) {
    navigator.clipboard.writeText(getInviteLink(customer)).then(() => {
      setCopiedInvite(customer.id);
      setTimeout(() => setCopiedInvite(null), 2000);
    });
  }

  function isBunchSelected(identifier: string, address: string) {
    return customerForm.selectedBunches.some(b => b.identifier === identifier && b.address === address);
  }

  function toggleCustomerBunch(identifier: string, address: string) {
    setCustomerForm(prev => ({
      ...prev,
      selectedBunches: isBunchSelected(identifier, address)
        ? prev.selectedBunches.filter(b => !(b.identifier === identifier && b.address === address))
        : [...prev.selectedBunches, { identifier, address }],
    }));
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Assignment Instructions</h1>
          <p className="text-gray-500 mt-1">Create templates and manage location-specific assignment documents</p>
        </div>
      </div>

      <Tabs defaultValue="template">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="template" className="flex items-center gap-1"><FileText className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Template</span></TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-1"><MapPin className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Locations</span></TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1"><Users className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Customers</span></TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1"><Settings className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Settings</span></TabsTrigger>
        </TabsList>

        {/* ── Template Builder ──────────────────────────────────── */}
        <TabsContent value="template" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Define the structure of assignment instructions. Every location follows this template.
              Adding or removing sections updates all location documents automatically.
            </p>
            {isAdmin && (
              <Button className="self-start sm:self-auto shrink-0" onClick={() => setShowAddSection(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            )}
          </div>

          {sectionsLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          )}

          {!sectionsLoading && sections.length === 0 && (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
              <FileText className="mx-auto h-10 w-10 mb-3" />
              <p className="text-sm">No template sections yet.</p>
              {isAdmin && <p className="text-xs mt-1">Click "Add Section" to build your template.</p>}
            </div>
          )}

          {sections.map((section: any, index: number) => (
            <Card key={section.id} className="border border-gray-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSection(index, "up")} disabled={index === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSection(index, "down")} disabled={index === sections.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate">{section.label}</span>
                      <SectionTypeLabel type={section.type} />
                      {section.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                    </div>
                    {section.options?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Options: {section.options.join(", ")}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(section)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove section?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will hide the <strong>{section.label}</strong> section from all locations. Existing content will be preserved in the audit history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSectionMutation.mutate(section.id)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Key Bunches (Locations) ────────────────────────────── */}
        <TabsContent value="locations" className="space-y-4 mt-4">
          <p className="text-sm text-gray-600">
            Each key bunch (identified by number and address) has its own assignment instructions.
            Multiple sets of the same bunch number at the same address share a single document.
          </p>
          {sections.length === 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-orange-700">⚠ Build the template first before editing assignment instructions.</p>
              </CardContent>
            </Card>
          )}
          {!keyBunchesLoading && keyBunches.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search by bunch number or address…"
                value={locationsSearch}
                onChange={e => setLocationsSearch(e.target.value)}
                className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {locationsSearch && (
                <button
                  onClick={() => setLocationsSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                >×</button>
              )}
            </div>
          )}
          {keyBunchesLoading && (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}</div>
          )}
          {!keyBunchesLoading && keyBunches.length === 0 && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
              <MapPin className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">No key bunches with addresses found.</p>
              <p className="text-xs mt-1">Add an address to key bunches in Key Management to see them here.</p>
            </div>
          )}
          {(() => {
            const filtered = keyBunches.filter(kb => {
              if (!locationsSearch.trim()) return true;
              const q = locationsSearch.toLowerCase();
              return kb.identifier.toLowerCase().includes(q) || kb.address.toLowerCase().includes(q);
            });
            if (locationsSearch.trim() && filtered.length === 0) return (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No bunches match "<strong>{locationsSearch}</strong>"</p>
              </div>
            );
            return null;
          })()}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keyBunches.filter(kb => {
              if (!locationsSearch.trim()) return true;
              const q = locationsSearch.toLowerCase();
              return kb.identifier.toLowerCase().includes(q) || kb.address.toLowerCase().includes(q);
            }).map((kb, idx) => {
              const params = new URLSearchParams({ identifier: kb.identifier, address: kb.address });
              return (
                <Card
                  key={idx}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/assignment-location?${params.toString()}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700">{kb.identifier}</span>
                      </div>
                      <CardTitle className="text-sm truncate">Bunch {kb.identifier}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-500 leading-relaxed truncate flex-1">{kb.address}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 shrink-0">
                        <Eye className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Customers ─────────────────────────────────────────── */}
        <TabsContent value="customers" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Create customer accounts so site owners can log into the customer portal and update their own assignment instructions.
            </p>
            {isAdmin && (
              <Button className="self-start sm:self-auto shrink-0" onClick={() => setShowAddCustomer(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            )}
          </div>

          {(customers as any[]).length === 0 && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
              <Users className="mx-auto h-10 w-10 mb-3" />
              <p className="text-sm">No customers yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {(customers as any[]).map((customer: any) => (
              <Card key={customer.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{customer.name || customer.email}</p>
                      {customer.name && <p className="text-xs text-gray-500 truncate">{customer.email}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {customer.assignmentBunches?.length > 0
                          ? <span className="text-xs text-gray-500">{customer.assignmentBunches.length} key bunch{customer.assignmentBunches.length !== 1 ? 'es' : ''} assigned</span>
                          : <span className="text-xs text-gray-400">No key bunches assigned</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!customer.passwordHash && customer.inviteToken && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => copyInviteLink(customer)}
                        >
                          {copiedInvite === customer.id ? (
                            <><CheckCircle className="mr-1 h-3 w-3 text-green-500" />Copied!</>
                          ) : (
                            <><Copy className="mr-1 h-3 w-3" />Copy invite</>
                          )}
                        </Button>
                      )}
                      {customer.passwordHash && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditingCustomer(customer);
                        setCustomerForm({ email: customer.email, name: customer.name ?? "", selectedBunches: customer.assignmentBunches ?? [] });
                        setBunchSearch("");
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove customer?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove <strong>{customer.name || customer.email}</strong> and revoke their access to the customer portal.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCustomerMutation.mutate(customer.id)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Settings ─────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Assignment Access Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Set a company-wide password that staff must enter to view assignment instructions.
                This does not affect customer portal access.
                {passwordCheck?.hasPassword
                  ? " A password is currently set."
                  : " No password is currently set — assignments are visible to all staff."}
              </p>
              <div className="space-y-3 max-w-sm">
                <div>
                  <Label htmlFor="new-pass">New Password</Label>
                  <Input id="new-pass" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
                </div>
                <div>
                  <Label htmlFor="confirm-pass">Confirm Password</Label>
                  <Input id="confirm-pass" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                </div>
                <Button
                  onClick={() => {
                    if (newPassword !== confirmPassword) {
                      toast({ title: "Passwords don't match", variant: "destructive" });
                      return;
                    }
                    if (newPassword.length < 6) {
                      toast({ title: "Password too short (min 6 characters)", variant: "destructive" });
                      return;
                    }
                    setPasswordMutation.mutate(newPassword);
                  }}
                  disabled={setPasswordMutation.isPending || !newPassword}
                >
                  {setPasswordMutation.isPending ? "Saving…" : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Customer Portal Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">Share this link with customers so they can access the portal.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-100 px-3 py-2 rounded-lg break-all">
                  {window.location.origin}/customer-portal
                </code>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/customer-portal`)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Section Dialog ────────────────────────────── */}
      <Dialog open={showAddSection || !!editingSection} onOpenChange={open => { if (!open) { setShowAddSection(false); setEditingSection(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add Template Section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingSection && (
              <div>
                <Label>Section Type</Label>
                <Select value={sectionForm.type} onValueChange={v => setSectionForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sectionForm.type !== "divider" && (
              <div>
                <Label>Label / Question</Label>
                <Input
                  className="mt-1"
                  value={sectionForm.label}
                  onChange={e => setSectionForm(f => ({ ...f, label: e.target.value }))}
                  placeholder={sectionForm.type === "heading" ? "e.g. Site Access Instructions" : "e.g. Emergency contact number"}
                />
              </div>
            )}
            {sectionForm.type === "dropdown" && (
              <div>
                <Label>Options (one per line)</Label>
                <textarea
                  className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm min-h-[100px] resize-y"
                  value={sectionForm.options}
                  onChange={e => setSectionForm(f => ({ ...f, options: e.target.value }))}
                  placeholder={"Option A\nOption B\nOption C"}
                />
              </div>
            )}
            {sectionForm.type !== "heading" && sectionForm.type !== "divider" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sectionForm.required}
                  onChange={e => setSectionForm(f => ({ ...f, required: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Required field</span>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAddSection(false); setEditingSection(null); }}>Cancel</Button>
              <Button
                onClick={() => {
                  const payload = {
                    type: sectionForm.type,
                    label: sectionForm.type === "divider" ? "Divider" : sectionForm.label.trim(),
                    options: sectionForm.type === "dropdown" ? sectionForm.options.split("\n").map(s => s.trim()).filter(Boolean) : null,
                    required: sectionForm.required,
                  };
                  if (!payload.label && sectionForm.type !== "divider") {
                    toast({ title: "Label is required", variant: "destructive" });
                    return;
                  }
                  if (editingSection) {
                    updateSectionMutation.mutate({ id: editingSection.id, ...payload });
                  } else {
                    addSectionMutation.mutate(payload);
                  }
                }}
                disabled={addSectionMutation.isPending || updateSectionMutation.isPending}
              >
                {editingSection ? "Save Changes" : "Add Section"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Customer Dialog ───────────────────────────── */}
      <Dialog open={showAddCustomer || !!editingCustomer} onOpenChange={open => { if (!open) { setShowAddCustomer(false); setEditingCustomer(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingCustomer && (
              <div>
                <Label>Email Address *</Label>
                <Input className="mt-1" type="email" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} placeholder="customer@example.com" />
              </div>
            )}
            <div>
              <Label>Display Name (optional)</Label>
              <Input className="mt-1" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="Site Owner Name" />
            </div>
            <div>
              <Label>
                Assign Key Bunches
                {customerForm.selectedBunches.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-blue-600">{customerForm.selectedBunches.length} selected</span>
                )}
              </Label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  placeholder="Search by bunch number or address…"
                  value={bunchSearch}
                  onChange={e => setBunchSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-t-lg border-b-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="border border-t-0 rounded-b-lg divide-y max-h-52 overflow-y-auto">
                {keyBunches.length === 0 && (
                  <p className="text-xs text-gray-400 p-3">No key bunches with addresses found.</p>
                )}
                {keyBunches
                  .filter(kb => {
                    if (!bunchSearch.trim()) return true;
                    const q = bunchSearch.toLowerCase();
                    return kb.identifier.toLowerCase().includes(q) || kb.address.toLowerCase().includes(q);
                  })
                  .map((kb, idx) => {
                    const selected = isBunchSelected(kb.identifier, kb.address);
                    return (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCustomerBunch(kb.identifier, kb.address)}
                          className="mt-0.5 rounded shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="text-sm font-medium">Bunch {kb.identifier}</span>
                          <span className="block text-xs text-gray-500 truncate">{kb.address}</span>
                        </span>
                      </label>
                    );
                  })}
                {keyBunches.length > 0 && bunchSearch.trim() && keyBunches.filter(kb => {
                  const q = bunchSearch.toLowerCase();
                  return kb.identifier.toLowerCase().includes(q) || kb.address.toLowerCase().includes(q);
                }).length === 0 && (
                  <p className="text-xs text-gray-400 p-3 italic">No bunches match your search.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAddCustomer(false); setEditingCustomer(null); setBunchSearch(""); }}>Cancel</Button>
              <Button
                onClick={() => {
                  if (editingCustomer) {
                    updateCustomerMutation.mutate({ id: editingCustomer.id, name: customerForm.name, bunches: customerForm.selectedBunches });
                  } else {
                    if (!customerForm.email.trim()) {
                      toast({ title: "Email is required", variant: "destructive" });
                      return;
                    }
                    addCustomerMutation.mutate({ email: customerForm.email, name: customerForm.name, bunches: customerForm.selectedBunches });
                  }
                }}
                disabled={addCustomerMutation.isPending || updateCustomerMutation.isPending}
              >
                {editingCustomer ? "Save Changes" : "Create Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
