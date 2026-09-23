import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Save, Users, Pencil } from "lucide-react";
import type { ReportField, ReportFieldType, ReportTemplate, ReportTemplatePermission } from "@shared/schema";

const FIELD_TYPES: { value: ReportFieldType; label: string }[] = [
  { value: "heading", label: "Heading (display only)" },
  { value: "text", label: "Single line text" },
  { value: "textarea", label: "Multi-line text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox (yes/no)" },
  { value: "image", label: "Image upload" },
];

function newField(type: ReportFieldType): ReportField {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: type === "heading" ? "Section heading" : "Untitled field",
    required: false,
    options: type === "dropdown" ? ["Option 1"] : undefined,
  };
}

export default function ReportsBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reports/builder/:id");
  const idParam = params?.id;
  const isNew = !idParam || idParam === "new";
  const templateId = isNew ? null : parseInt(idParam!);
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  useEffect(() => { if (user && !isAdmin) setLocation("/reports"); }, [user, isAdmin, setLocation]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<ReportField[]>([]);
  const [editingField, setEditingField] = useState<ReportField | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  const { data: template } = useQuery<ReportTemplate>({
    queryKey: ["/api/report-templates", templateId],
    queryFn: () => fetch(`/api/report-templates/${templateId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: !!templateId,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setFields((template.fields as ReportField[]) ?? []);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return await apiRequest("POST", "/api/report-templates", { name, description, fields });
      }
      return await apiRequest("PATCH", `/api/report-templates/${templateId}`, { name, description, fields });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({ title: isNew ? "Template created" : "Template saved" });
      if (isNew && data?.id) setLocation(`/reports/builder/${data.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function addField(type: ReportFieldType) { setFields(prev => [...prev, newField(type)]); }
  function removeField(id: string) { setFields(prev => prev.filter(f => f.id !== id)); }
  function moveField(idx: number, dir: -1 | 1) {
    setFields(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function updateField(updated: ReportField) {
    setFields(prev => prev.map(f => (f.id === updated.id ? updated : f)));
    setEditingField(null);
  }

  const canSave = name.trim().length > 0 && fields.length > 0;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link href="/reports/manage"><Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{isNew ? "New Report Template" : "Edit Template"}</h1>
            <p className="text-sm text-muted-foreground">Define the questions and fields users will fill in</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" onClick={() => setShowPermissions(true)} data-testid="button-permissions">
              <Users className="h-4 w-4 mr-2" /> Permissions
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} data-testid="button-save">
            <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="tmpl-name">Template name *</Label>
            <Input id="tmpl-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily Patrol Report" data-testid="input-template-name" />
          </div>
          <div>
            <Label htmlFor="tmpl-desc">Description</Label>
            <Textarea id="tmpl-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about when to use this report" data-testid="input-template-description" rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Fields ({fields.length})</span>
            <AddFieldMenu onAdd={addField} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No fields yet. Use "Add field" to start.</p>
          ) : (
            fields.map((f, idx) => (
              <div key={f.id} className="flex items-center gap-2 p-3 rounded-md border" data-testid={`field-row-${f.id}`}>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveField(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{f.label}</span>
                    <Badge variant="outline" className="text-xs">{FIELD_TYPES.find(t => t.value === f.type)?.label ?? f.type}</Badge>
                    {f.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </div>
                  {f.helpText && <div className="text-xs text-muted-foreground mt-1">{f.helpText}</div>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingField(f)} data-testid={`button-edit-field-${f.id}`}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => removeField(f.id)} data-testid={`button-remove-field-${f.id}`}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {editingField && (
        <FieldEditDialog field={editingField} onClose={() => setEditingField(null)} onSave={updateField} />
      )}

      {!isNew && showPermissions && templateId && (
        <PermissionsDialog templateId={templateId} onClose={() => setShowPermissions(false)} />
      )}
    </div>
  );
}

function AddFieldMenu({ onAdd }: { onAdd: (t: ReportFieldType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-field"><Plus className="h-4 w-4 mr-1" /> Add field</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Choose a field type</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_TYPES.map(t => (
            <Button
              key={t.value}
              variant="outline"
              className="justify-start"
              onClick={() => { onAdd(t.value); setOpen(false); }}
              data-testid={`button-add-type-${t.value}`}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldEditDialog({ field, onClose, onSave }: { field: ReportField; onClose: () => void; onSave: (f: ReportField) => void }) {
  const [draft, setDraft] = useState<ReportField>(field);
  const isHeading = draft.type === "heading";
  const isDropdown = draft.type === "dropdown";
  const isCheckbox = draft.type === "checkbox";
  const supportsFollowUp = isDropdown || isCheckbox;
  // Migrate legacy single-prompt follow-up config to the new per-option `followUps` map on first render
  const initialFollowUps: Record<string, { label?: string; required?: boolean }> = (() => {
    if (field.followUps) return { ...field.followUps };
    const legacy: Record<string, { label?: string; required?: boolean }> = {};
    const triggers = field.followUpTriggers ?? [];
    if (field.type === "checkbox" && triggers.length > 0) {
      // Normalize legacy checkbox follow-up to the canonical "true" key
      legacy["true"] = { label: field.followUpLabel, required: field.followUpRequired };
    } else {
      triggers.forEach(t => {
        legacy[t] = { label: field.followUpLabel, required: field.followUpRequired };
      });
    }
    return legacy;
  })();
  const [followUps, setFollowUps] = useState<Record<string, { label?: string; required?: boolean }>>(initialFollowUps);
  const [followUpEnabled, setFollowUpEnabled] = useState<boolean>(Object.keys(initialFollowUps).length > 0);

  // Raw text for the options textarea — kept verbatim so the user can type spaces and blank lines
  const [optionsText, setOptionsText] = useState<string>((field.options ?? []).join("\n"));

  function toggleFollowUp(opt: string, on: boolean) {
    setFollowUps(prev => {
      const next = { ...prev };
      if (on) next[opt] = next[opt] ?? { label: "", required: false };
      else delete next[opt];
      return next;
    });
  }
  function updateFollowUp(opt: string, patch: Partial<{ label: string; required: boolean }>) {
    setFollowUps(prev => ({ ...prev, [opt]: { ...(prev[opt] ?? {}), ...patch } }));
  }

  // Parsed options derived from the raw textarea text — only cleaned up at this layer
  const parsedOptions = optionsText.split("\n").map(s => s.trim()).filter(Boolean);

  function handleSave() {
    const finalDraft: ReportField = isDropdown
      ? { ...draft, options: parsedOptions }
      : draft;
    if (!supportsFollowUp || !followUpEnabled) {
      onSave({
        ...finalDraft,
        followUps: undefined,
        followUpTriggers: undefined,
        followUpLabel: undefined,
        followUpRequired: false,
      });
      return;
    }
    // Build the cleaned per-option config
    const cleaned: Record<string, { label?: string; required?: boolean }> = {};
    if (isCheckbox) {
      const cfg = followUps["true"] ?? { label: "", required: false };
      cleaned["true"] = { label: cfg.label?.trim() || undefined, required: !!cfg.required };
    } else {
      // Drop entries for options that no longer exist
      parsedOptions.forEach(opt => {
        if (followUps[opt]) {
          cleaned[opt] = { label: followUps[opt].label?.trim() || undefined, required: !!followUps[opt].required };
        }
      });
    }
    onSave({
      ...finalDraft,
      followUps: cleaned,
      // Keep legacy fields in sync (cleared) so old renderers don't double-handle
      followUpTriggers: Object.keys(cleaned),
      followUpLabel: undefined,
      followUpRequired: undefined,
    });
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit field</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{isHeading ? "Heading text" : "Question / label"}</Label>
            <Input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} data-testid="input-field-label" />
          </div>
          {!isHeading && (
            <>
              <div>
                <Label>Help text (optional)</Label>
                <Input value={draft.helpText ?? ""} onChange={e => setDraft({ ...draft, helpText: e.target.value })} placeholder="Hint shown under the field" />
              </div>
              {(draft.type === "text" || draft.type === "textarea" || draft.type === "number") && (
                <div>
                  <Label>Placeholder (optional)</Label>
                  <Input value={draft.placeholder ?? ""} onChange={e => setDraft({ ...draft, placeholder: e.target.value })} />
                </div>
              )}
              {isDropdown && (
                <div>
                  <Label>Options (one per line)</Label>
                  <Textarea
                    rows={5}
                    value={optionsText}
                    onChange={e => setOptionsText(e.target.value)}
                    data-testid="input-field-options"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={draft.required} onCheckedChange={v => setDraft({ ...draft, required: v })} data-testid="switch-field-required" />
                <Label>Required</Label>
              </div>

              {supportsFollowUp && (
                <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={followUpEnabled}
                      onCheckedChange={v => setFollowUpEnabled(v)}
                      data-testid="switch-followup-enabled"
                    />
                    <Label className="font-medium">Show a follow-up text box</Label>
                  </div>
                  {followUpEnabled && isCheckbox && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">A text box will appear when this checkbox is ticked.</p>
                      <div>
                        <Label className="text-xs">Follow-up prompt (optional)</Label>
                        <Input
                          value={followUps["true"]?.label ?? ""}
                          onChange={e => updateFollowUp("true", { label: e.target.value })}
                          placeholder="e.g. Please provide details"
                          data-testid="input-followup-label"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!followUps["true"]?.required}
                          onCheckedChange={v => updateFollowUp("true", { required: v })}
                          data-testid="switch-followup-required"
                        />
                        <Label className="text-sm">Follow-up answer required</Label>
                      </div>
                    </div>
                  )}

                  {followUpEnabled && isDropdown && (
                    <div className="space-y-2">
                      {parsedOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Add some options above first.</p>
                      ) : (
                        <div className="border rounded-md overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 bg-muted text-xs font-medium">
                            <div>Option</div>
                            <div>Needs follow-up</div>
                          </div>
                          <div className="divide-y">
                            {parsedOptions.map(opt => {
                              const cfg = followUps[opt];
                              const enabled = !!cfg;
                              return (
                                <div key={opt} className="px-3 py-2 space-y-2">
                                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                    <div className="text-sm break-words">{opt}</div>
                                    <Checkbox
                                      checked={enabled}
                                      onCheckedChange={v => toggleFollowUp(opt, !!v)}
                                      data-testid={`checkbox-trigger-${opt}`}
                                    />
                                  </div>
                                  {enabled && (
                                    <div className="ml-2 pl-3 border-l-2 border-orange-200 space-y-2">
                                      <div>
                                        <Label className="text-xs">Follow-up prompt for "{opt}"</Label>
                                        <Input
                                          value={cfg?.label ?? ""}
                                          onChange={e => updateFollowUp(opt, { label: e.target.value })}
                                          placeholder="e.g. Please specify"
                                          data-testid={`input-followup-label-${opt}`}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={!!cfg?.required}
                                          onCheckedChange={v => updateFollowUp(opt, { required: v })}
                                          data-testid={`switch-followup-required-${opt}`}
                                        />
                                        <Label className="text-sm">Answer required</Label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!draft.label.trim()} data-testid="button-save-field">Save field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsDialog({ templateId, onClose }: { templateId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: existing = [] } = useQuery<ReportTemplatePermission[]>({
    queryKey: ["/api/report-templates", templateId, "permissions"],
    queryFn: () => fetch(`/api/report-templates/${templateId}/permissions`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
  });
  const [perms, setPerms] = useState<Record<number, { canFill: boolean; canView: boolean }>>({});

  useEffect(() => {
    const map: Record<number, { canFill: boolean; canView: boolean }> = {};
    existing.forEach(p => { map[p.userId] = { canFill: p.canFill, canView: p.canView }; });
    setPerms(map);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/report-templates/${templateId}/permissions`, {
        permissions: Object.entries(perms)
          .filter(([_, v]) => v.canFill || v.canView)
          .map(([userId, v]) => ({ userId: parseInt(userId), canFill: v.canFill, canView: v.canView })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates", templateId, "permissions"] });
      toast({ title: "Permissions saved" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const staffUsers = users.filter((u: any) => u.role !== "admin" && u.role !== "super_admin");

  function toggle(userId: number, key: "canFill" | "canView", val: boolean) {
    setPerms(prev => ({ ...prev, [userId]: { canFill: prev[userId]?.canFill ?? false, canView: prev[userId]?.canView ?? false, [key]: val } }));
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Template Permissions</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Admins always have full access. Choose which staff members can fill in this report and who can view submissions.
        </p>
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="text-left py-2">User</th>
                <th className="py-2 w-24 text-center">Can fill</th>
                <th className="py-2 w-24 text-center">Can view</th>
              </tr>
            </thead>
            <tbody>
              {staffUsers.length === 0 && (
                <tr><td colSpan={3} className="text-center text-muted-foreground py-6">No staff users found.</td></tr>
              )}
              {staffUsers.map((u: any) => (
                <tr key={u.id} className="border-b" data-testid={`perm-row-${u.id}`}>
                  <td className="py-2">
                    <div className="font-medium">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="py-2 text-center">
                    <Checkbox
                      checked={perms[u.id]?.canFill ?? false}
                      onCheckedChange={v => toggle(u.id, "canFill", !!v)}
                      data-testid={`checkbox-fill-${u.id}`}
                    />
                  </td>
                  <td className="py-2 text-center">
                    <Checkbox
                      checked={perms[u.id]?.canView ?? false}
                      onCheckedChange={v => toggle(u.id, "canView", !!v)}
                      data-testid={`checkbox-view-${u.id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-permissions">
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
