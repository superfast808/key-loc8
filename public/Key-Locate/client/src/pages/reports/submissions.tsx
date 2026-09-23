import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import type { ReportTemplate, ReportSubmission } from "@shared/schema";

type Row = ReportSubmission & { submitterName: string | null; submitterEmail: string | null };

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReportsSubmissions() {
  const [, params] = useRoute("/reports/submissions/:id");
  const templateId = params?.id ? parseInt(params.id) : null;

  const { data: template } = useQuery<ReportTemplate>({
    queryKey: ["/api/report-templates", templateId],
    queryFn: () => fetch(`/api/report-templates/${templateId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: !!templateId,
  });
  const { data: submissions = [], isLoading } = useQuery<Row[]>({
    queryKey: ["/api/report-templates", templateId, "submissions"],
    queryFn: () => fetch(`/api/report-templates/${templateId}/submissions`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    enabled: !!templateId,
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports"><Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{template?.name ?? "Submissions"}</h1>
          <p className="text-sm text-muted-foreground">{submissions.length} submission{submissions.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : submissions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">No submissions yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map(s => (
            <Link key={s.id} href={`/reports/submission/${s.id}`}>
              <Card className="cursor-pointer hover:bg-accent" data-testid={`submission-row-${s.id}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.submitterName || s.submitterEmail || `User #${s.submittedBy}`}</div>
                      <div className="text-xs text-muted-foreground">{fmt(s.createdAt)}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
