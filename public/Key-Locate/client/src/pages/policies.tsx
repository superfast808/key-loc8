import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Plus, Trash2, Eye, Upload, FileUp, Pencil, RefreshCw } from "lucide-react";

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PoliciesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";

  const { data: policies = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/policies"],
  });

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingPolicy, setEditingPolicy] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/policies/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Policy deleted" });
    },
    onError: () => toast({ title: "Error", description: "Could not delete policy", variant: "destructive" }),
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim()) return;

    setUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      await apiRequest("POST", "/api/policies", {
        name: uploadName.trim(),
        description: uploadDescription.trim() || null,
        fileData,
        fileName: uploadFile.name,
        fileType: uploadFile.type || "application/octet-stream",
        fileSize: uploadFile.size,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Policy uploaded", description: uploadFile.name });
      setShowUpload(false);
      setUploadName("");
      setUploadDescription("");
      setUploadFile(null);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function openEditDialog(policy: any) {
    setEditingPolicy(policy);
    setEditName(policy.name);
    setEditDescription(policy.description ?? "");
    setEditFile(null);
  }

  function closeEditDialog() {
    setEditingPolicy(null);
    setEditName("");
    setEditDescription("");
    setEditFile(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPolicy || !editName.trim()) return;

    setSaving(true);
    try {
      const body: any = {
        name: editName.trim(),
        description: editDescription.trim() || null,
      };

      if (editFile) {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1] ?? result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(editFile);
        });
        body.fileData = fileData;
        body.fileName = editFile.name;
        body.fileType = editFile.type || "application/octet-stream";
        body.fileSize = editFile.size;
      }

      await apiRequest("PATCH", `/api/policies/${editingPolicy.id}`, body);
      queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
      toast({ title: "Policy updated" });
      closeEditDialog();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openFile(policyId: number) {
    window.open(`/api/policies/${policyId}/file`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Policies</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? "Manage and share company policies and documents" : "View the policies available to you"}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                Upload Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload a Policy</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <Label htmlFor="policy-name">Policy name *</Label>
                  <Input
                    id="policy-name"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="e.g. Fire Safety Policy"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="policy-desc">Description (optional)</Label>
                  <Input
                    id="policy-desc"
                    value={uploadDescription}
                    onChange={e => setUploadDescription(e.target.value)}
                    placeholder="Brief description of this document"
                  />
                </div>
                <div>
                  <Label>File *</Label>
                  <div
                    className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploadFile ? (
                      <div className="space-y-1">
                        <FileText className="mx-auto h-8 w-8 text-blue-500" />
                        <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <FileUp className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to select a file</p>
                        <p className="text-xs text-gray-400">PDF, Word, Excel, images — any file type</p>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading || !uploadFile || !uploadName.trim()}>
                    {uploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-pulse" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && policies.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <FileText className="mx-auto h-12 w-12 mb-4" />
          <p className="text-sm">
            {isAdmin ? "No policies uploaded yet. Click 'Upload Policy' to add one." : "No policies have been shared with you yet."}
          </p>
        </div>
      )}

      {!isLoading && policies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy: any) => (
            <Card key={policy.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                    <CardTitle className="text-base leading-tight truncate">{policy.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {policy.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{policy.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  <Badge variant="outline" className="text-xs font-normal">{policy.fileName}</Badge>
                  <span>{formatFileSize(policy.fileSize)}</span>
                  <span>·</span>
                  <span>{formatDate(policy.createdAt)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openFile(policy.id)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        onClick={() => openEditDialog(policy)}
                        title="Edit policy"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete <strong>{policy.name}</strong> and remove access for all users. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(policy.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Policy Dialog */}
      <Dialog open={!!editingPolicy} onOpenChange={open => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit-policy-name">Policy name *</Label>
              <Input
                id="edit-policy-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="e.g. Fire Safety Policy"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-policy-desc">Description (optional)</Label>
              <Input
                id="edit-policy-desc"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Brief description of this document"
              />
            </div>
            <div>
              <Label>Replace document (optional)</Label>
              <div
                className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-blue-400 border-gray-300"
                onClick={() => editFileRef.current?.click()}
              >
                {editFile ? (
                  <div className="space-y-1">
                    <FileText className="mx-auto h-7 w-7 text-blue-500" />
                    <p className="text-sm font-medium text-gray-900">{editFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(editFile.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <RefreshCw className="h-5 w-5" />
                      <span className="text-sm text-gray-500 font-medium">{editingPolicy?.fileName}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Click to select a new file to replace the current one</p>
                  </div>
                )}
                <input
                  ref={editFileRef}
                  type="file"
                  className="hidden"
                  onChange={e => setEditFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !editName.trim()}>
                {saving ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-pulse" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
