import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Send, Upload, X } from "lucide-react";
import { FOLLOWUP_KEY, type ReportField, type ReportTemplate, type ReportFieldValue } from "@shared/schema";

function getFollowUpConfig(
  f: ReportField,
  value: ReportFieldValue | undefined,
): { label?: string; required?: boolean } | null {
  // Prefer the new per-option `followUps` map; only fall back to legacy when the new map is missing entirely
  const useLegacy = !f.followUps;
  const map: Record<string, { label?: string; required?: boolean }> = useLegacy
    ? (() => {
        const legacy: Record<string, { label?: string; required?: boolean }> = {};
        const triggers = f.followUpTriggers ?? [];
        if (f.type === "checkbox" && triggers.length > 0) {
          // Legacy checkbox followUp: always normalize to the "true" key, regardless of trigger value
          legacy["true"] = { label: f.followUpLabel, required: f.followUpRequired };
        } else {
          triggers.forEach(t => {
            legacy[t] = { label: f.followUpLabel, required: f.followUpRequired };
          });
        }
        return legacy;
      })()
    : f.followUps!;
  if (Object.keys(map).length === 0) return null;
  if (f.type === "checkbox") return value === true ? (map["true"] ?? null) : null;
  if (f.type === "dropdown" && typeof value === "string") return map[value] ?? null;
  return null;
}

export default function ReportsFill() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reports/fill/:id");
  const templateId = params?.id ? parseInt(params.id) : null;

  const { data: template, isLoading } = useQuery<ReportTemplate>({
    queryKey: ["/api/report-templates", templateId],
    queryFn: () => fetch(`/api/report-templates/${templateId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: !!templateId,
  });

  const [values, setValues] = useState<Record<string, ReportFieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitMutation = useMutation({
    mutationFn: () => {
      // Strip any follow-up answers whose trigger condition is not currently met,
      // so stale data from earlier selections never reaches the server.
      const fields = (template?.fields ?? []) as ReportField[];
      const cleaned: Record<string, ReportFieldValue> = { ...values };
      fields.forEach(f => {
        if (f.type !== "dropdown" && f.type !== "checkbox") return;
        const fuCfg = getFollowUpConfig(f, values[f.id]);
        if (!fuCfg) delete cleaned[FOLLOWUP_KEY(f.id)];
      });
      return apiRequest("POST", `/api/report-templates/${templateId}/submissions`, { data: cleaned });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you — your report has been recorded." });
      setLocation("/reports");
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  function setVal(id: string, v: ReportFieldValue) {
    setValues(prev => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function handleImageUpload(fieldId: string, file: File | null) {
    if (!file) { setVal(fieldId, null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setVal(fieldId, result); // data URL string
    };
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const fields = (template?.fields ?? []) as ReportField[];
    const next: Record<string, string> = {};
    fields.forEach(f => {
      if (f.type === "heading") return;
      const v = values[f.id];
      if (f.required && (v === undefined || v === null || v === "" || (f.type === "checkbox" && v !== true))) {
        next[f.id] = "This field is required";
      }
      const fuCfg = getFollowUpConfig(f, v);
      if (fuCfg && fuCfg.required) {
        const fv = values[FOLLOWUP_KEY(f.id)];
        if (!fv || (typeof fv === "string" && !fv.trim())) {
          next[FOLLOWUP_KEY(f.id)] = "Please provide details";
        }
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast({ title: "Missing required fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  }

  if (isLoading) return <div className="container mx-auto p-6 text-center text-muted-foreground">Loading…</div>;
  if (!template) return <div className="container mx-auto p-6 text-center text-muted-foreground">Template not found</div>;

  const fields = (template.fields ?? []) as ReportField[];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports"><Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-4 md:p-6 space-y-5">
            {fields.length === 0 && (
              <p className="text-center text-muted-foreground py-6">This template has no fields yet.</p>
            )}
            {fields.map(f => (
              <div key={f.id} className="space-y-2">
                <FieldRenderer
                  field={f}
                  value={values[f.id]}
                  error={errors[f.id]}
                  onChange={v => setVal(f.id, v)}
                  onImageUpload={file => handleImageUpload(f.id, file)}
                />
                {(() => {
                  const fuCfg = getFollowUpConfig(f, values[f.id]);
                  if (!fuCfg) return null;
                  return (
                  <div className="ml-6 pl-3 border-l-2 border-orange-200 space-y-1">
                    <Label htmlFor={`${f.id}-followup`} className="text-sm">
                      {fuCfg.label || "Please provide details"}
                      {fuCfg.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <Textarea
                      id={`${f.id}-followup`}
                      rows={3}
                      value={(values[FOLLOWUP_KEY(f.id)] as string) ?? ""}
                      onChange={e => setVal(FOLLOWUP_KEY(f.id), e.target.value)}
                      data-testid={`field-followup-${f.id}`}
                    />
                    {errors[FOLLOWUP_KEY(f.id)] && (
                      <p className="text-xs text-destructive">{errors[FOLLOWUP_KEY(f.id)]}</p>
                    )}
                  </div>
                  );
                })()}
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-end gap-2">
          <Link href="/reports"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={submitMutation.isPending || fields.length === 0} data-testid="button-submit">
            <Send className="h-4 w-4 mr-2" /> {submitMutation.isPending ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldRenderer({
  field, value, error, onChange, onImageUpload,
}: {
  field: ReportField;
  value: ReportFieldValue | undefined;
  error?: string;
  onChange: (v: ReportFieldValue) => void;
  onImageUpload: (file: File | null) => void;
}) {
  if (field.type === "heading") {
    return <div className="pt-2"><h3 className="text-lg font-semibold border-b pb-1">{field.label}</h3>{field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}</div>;
  }
  const labelEl = (
    <Label htmlFor={field.id} className="font-medium">
      {field.label} {field.required && <span className="text-destructive">*</span>}
    </Label>
  );
  const hint = field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>;
  const errEl = error && <p className="text-xs text-destructive">{error}</p>;
  const testId = `field-input-${field.id}`;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Input id={field.id} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} data-testid={testId} />
          {errEl}
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Textarea id={field.id} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={4} data-testid={testId} />
          {errEl}
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Input id={field.id} type="number" value={(value as number | string) ?? ""} onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder={field.placeholder} data-testid={testId} />
          {errEl}
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Input id={field.id} type="date" value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} data-testid={testId} />
          {errEl}
        </div>
      );
    case "time":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Input id={field.id} type="time" value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} data-testid={testId} />
          {errEl}
        </div>
      );
    case "dropdown":
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger data-testid={testId}><SelectValue placeholder="Select an option…" /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errEl}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <Checkbox id={field.id} checked={value === true} onCheckedChange={v => onChange(!!v)} data-testid={testId} />
            <div>
              <Label htmlFor={field.id} className="font-medium cursor-pointer">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {hint}
            </div>
          </div>
          {errEl}
        </div>
      );
    case "image": {
      const v = value as string | null | undefined;
      return (
        <div className="space-y-1">
          {labelEl}{hint}
          {v ? (
            <div className="relative inline-block">
              <img src={v} alt="upload" className="max-h-40 rounded border" />
              <Button type="button" size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => onImageUpload(null)} data-testid={`button-remove-image-${field.id}`}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded cursor-pointer hover:bg-accent" data-testid={testId}>
              <Upload className="h-4 w-4" />
              <span className="text-sm text-muted-foreground">Click to upload an image</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => onImageUpload(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {errEl}
        </div>
      );
    }
    default:
      return null;
  }
}
