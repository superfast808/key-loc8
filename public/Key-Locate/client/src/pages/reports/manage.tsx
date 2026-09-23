import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ClipboardList, Plus, Pencil, Trash2, ArrowLeft, FileText, Sparkles, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { ReportTemplate } from "@shared/schema";

export default function ReportsManage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  useEffect(() => {
    if (user && !isAdmin) setLocation("/reports");
  }, [user, isAdmin, setLocation]);

  const { data: templates = [], isLoading } = useQuery<(ReportTemplate & { canFill: boolean; canView: boolean })[]>({
    queryKey: ["/api/report-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/report-templates/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/report-templates/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] }),
  });

  // ─── AI Template Generation ───
  const [aiOpen, setAiOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiFileName, setAiFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAiFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        // CSV preserves columns/rows in a way the model handles well
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
        if (!csv) continue;
        parts.push(`# Sheet: ${sheetName}\n${csv}`);
      }
      let text = parts.join("\n\n");
      if (!text) {
        toast({ title: "Empty file", description: "Couldn't find any data in that spreadsheet.", variant: "destructive" });
        return;
      }
      // Hard cap matches the server's 30k limit, leave headroom for any user notes
      const CAP = 28000;
      if (text.length > CAP) text = text.slice(0, CAP) + "\n\n[…truncated]";
      setAiDescription(prev => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      setAiFileName(file.name);
      toast({ title: "Spreadsheet loaded", description: `${file.name} added to the prompt.` });
    } catch (e: any) {
      toast({ title: "Couldn't read file", description: e.message ?? "Unsupported file", variant: "destructive" });
    }
  };

  const clearAiFile = () => {
    setAiFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const aiGenerateMutation = useMutation({
    // Single atomic call — server generates + saves as INACTIVE in one transaction
    mutationFn: (description: string) =>
      apiRequest("POST", "/api/report-templates/ai-generate", { description }),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-templates"] });
      toast({
        title: "Draft created",
        description: "Review and tweak the generated template, then mark it Active.",
      });
      setAiOpen(false);
      setAiDescription("");
      clearAiFile();
      setLocation(`/reports/builder/${created.id}`);
    },
    onError: (e: any) => toast({ title: "AI generation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link href="/reports"><Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Manage Report Templates</h1>
              <p className="text-sm text-muted-foreground">Create, edit and assign permissions for templates</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setAiOpen(true)}
            data-testid="button-ai-generate"
            className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Create with AI
          </Button>
          <Link href="/reports/builder/new">
            <Button data-testid="button-new-template"><Plus className="h-4 w-4 mr-2" /> New Template</Button>
          </Link>
        </div>
      </div>

      <Dialog open={aiOpen} onOpenChange={v => {
        if (aiGenerateMutation.isPending) return;
        setAiOpen(v);
        if (!v) clearAiFile();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" /> Create a template with AI
            </DialogTitle>
            <DialogDescription>
              Paste your report logic, upload an Excel/CSV file with the fields, or describe what the report should
              capture. The AI will draft a template — including dropdowns, follow-up questions and required fields —
              which you can review and tweak in the builder before going live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleAiFile(f);
                }}
                data-testid="input-ai-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={aiGenerateMutation.isPending}
                data-testid="button-ai-upload"
              >
                <Upload className="h-4 w-4 mr-2" /> Upload spreadsheet
              </Button>
              {aiFileName && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[240px] truncate">{aiFileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={clearAiFile}
                    disabled={aiGenerateMutation.isPending}
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">.xlsx, .xls, .csv, .ods</span>
            </div>
            <Textarea
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              rows={12}
              placeholder={`Examples:\n\n• Mobile patrol report. Capture officer name, site, arrival/departure time, weather, lock-up status (yes/no — if no, ask why), any incidents (yes/no — if yes, describe and upload a photo), and a final signature.\n\n• Or paste columns from a spreadsheet like:\nField | Type | Required | Notes\nOfficer name | text | yes\nReason of attendance | dropdown | yes | Access / Lock up / Open up — if Access, ask who for`}
              disabled={aiGenerateMutation.isPending}
              data-testid="input-ai-description"
            />
            <p className="text-xs text-muted-foreground">
              The draft will be saved as <strong>inactive</strong> so you can review it before staff can use it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerateMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => aiGenerateMutation.mutate(aiDescription.trim())}
              disabled={!aiDescription.trim() || aiGenerateMutation.isPending}
              data-testid="button-ai-submit"
            >
              {aiGenerateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate template</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. Click "New Template" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} data-testid={`template-row-${t.id}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <div className="font-medium truncate">{t.name}</div>
                    <Badge variant="secondary">{(t.fields as any[])?.length ?? 0} fields</Badge>
                    {!t.isActive && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  {t.description && (
                    <div className="text-sm text-muted-foreground mt-1 truncate">{t.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={t.isActive}
                      onCheckedChange={v => toggleActiveMutation.mutate({ id: t.id, isActive: v })}
                      data-testid={`switch-active-${t.id}`}
                    />
                    <span className="text-muted-foreground">Active</span>
                  </div>
                  <Link href={`/reports/submissions/${t.id}`}>
                    <Button size="sm" variant="outline" data-testid={`button-view-submissions-${t.id}`}>Submissions</Button>
                  </Link>
                  <Link href={`/reports/builder/${t.id}`}>
                    <Button size="sm" variant="outline" data-testid={`button-edit-${t.id}`}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" data-testid={`button-delete-${t.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the template "{t.name}" along with all its submissions. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
