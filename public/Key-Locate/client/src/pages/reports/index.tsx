import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, FileText, Eye, Settings, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ReportTemplate } from "@shared/schema";

type TemplateRow = ReportTemplate & { canFill: boolean; canView: boolean };

export default function ReportsIndex() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  const { data: templates = [], isLoading } = useQuery<TemplateRow[]>({
    queryKey: ["/api/report-templates"],
  });

  const fillable = templates.filter(t => t.canFill && t.isActive);
  const viewable = templates.filter(t => t.canView);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-sm text-muted-foreground">Fill in custom reports and review submissions</p>
          </div>
        </div>
        {isAdmin && (
          <Link href="/reports/manage">
            <Button data-testid="button-manage-templates">
              <Settings className="h-4 w-4 mr-2" /> Manage Templates
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Available Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {fillable.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No reports available to fill.</p>
              ) : (
                fillable.map(t => (
                  <Link key={t.id} href={`/reports/fill/${t.id}`}>
                    <div
                      className="flex items-center justify-between p-3 rounded-md border hover:bg-accent cursor-pointer"
                      data-testid={`fillable-template-${t.id}`}
                    >
                      <div>
                        <div className="font-medium">{t.name}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        )}
                      </div>
                      <Button size="sm" variant="outline">Fill out</Button>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-orange-600" />
                View Submissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {viewable.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No submissions accessible.</p>
              ) : (
                viewable.map(t => (
                  <Link key={t.id} href={`/reports/submissions/${t.id}`}>
                    <div
                      className="flex items-center justify-between p-3 rounded-md border hover:bg-accent cursor-pointer"
                      data-testid={`viewable-template-${t.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{t.name}</div>
                        {!t.isActive && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <Button size="sm" variant="outline">View</Button>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {isAdmin && templates.length === 0 && !isLoading && (
        <Card className="mt-6 border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No report templates yet. Create your first one.</p>
            <Link href="/reports/builder/new">
              <Button><Plus className="h-4 w-4 mr-2" /> New Template</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
