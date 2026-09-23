import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Trash2, FileText, CheckCircle2, XCircle } from "lucide-react";
import { FOLLOWUP_KEY, type ReportField, type ReportTemplate, type ReportSubmission, type ReportFieldValue } from "@shared/schema";

function getFollowUpConfig(
  f: ReportField,
  value: ReportFieldValue | undefined,
): { label?: string; required?: boolean } | null {
  const useLegacy = !f.followUps;
  const map: Record<string, { label?: string; required?: boolean }> = useLegacy
    ? (() => {
        const legacy: Record<string, { label?: string; required?: boolean }> = {};
        const triggers = f.followUpTriggers ?? [];
        if (f.type === "checkbox" && triggers.length > 0) {
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

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReportsSubmissionDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reports/submission/:id");
  const submissionId = params?.id ? parseInt(params.id) : null;
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  const { data, isLoading } = useQuery<{ submission: ReportSubmission; template: ReportTemplate }>({
    queryKey: ["/api/report-submissions", submissionId],
    queryFn: () => fetch(`/api/report-submissions/${submissionId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: !!submissionId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/report-submissions/${submissionId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({ title: "Submission deleted" });
      if (data?.template?.id) setLocation(`/reports/submissions/${data.template.id}`);
      else setLocation("/reports");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="container mx-auto p-6 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="container mx-auto p-6 text-center text-muted-foreground">Submission not found</div>;

  const { submission, template } = data;
  const fields = (template.fields ?? []) as ReportField[];
  const values = (submission.data ?? {}) as Record<string, ReportFieldValue>;
  const backHref = `/reports/submissions/${template.id}`;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href={backHref}><Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">Submitted {fmt(submission.createdAt)}</p>
          </div>
        </div>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-delete-submission"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes this submission. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Submission Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm border-b pb-3">
            <div>
              <div className="text-muted-foreground">Submitted by</div>
              <div className="font-medium">User #{submission.submittedBy}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Submitted at</div>
              <div className="font-medium">{fmt(submission.createdAt)}</div>
            </div>
          </div>
          {fields.map(f => {
            if (f.type === "heading") {
              return <h3 key={f.id} className="text-base font-semibold border-b pb-1 pt-2">{f.label}</h3>;
            }
            const v = values[f.id];
            const fuCfg = getFollowUpConfig(f, v);
            const followUpVal = values[FOLLOWUP_KEY(f.id)];
            return (
              <div key={f.id} className="space-y-1" data-testid={`submission-field-${f.id}`}>
                <div className="text-sm text-muted-foreground">{f.label}</div>
                <div className="text-sm">{renderValue(f, v)}</div>
                {fuCfg && (
                  <div className="ml-4 pl-3 border-l-2 border-orange-200 mt-2">
                    <div className="text-xs text-muted-foreground">{fuCfg.label || "Details"}</div>
                    <div className="text-sm whitespace-pre-wrap">
                      {followUpVal && String(followUpVal).trim()
                        ? String(followUpVal)
                        : <span className="text-muted-foreground italic">Not provided</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function renderValue(field: ReportField, value: ReportFieldValue | undefined) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }
  switch (field.type) {
    case "checkbox":
      return value === true
        ? <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Yes</Badge>
        : <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> No</Badge>;
    case "image":
      return <img src={value as string} alt={field.label} className="max-h-64 rounded border" />;
    case "textarea":
      return <div className="whitespace-pre-wrap">{String(value)}</div>;
    default:
      return <div className="font-medium">{String(value)}</div>;
  }
}
