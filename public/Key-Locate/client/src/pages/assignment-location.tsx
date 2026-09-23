import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, History, Clock, User, Lock, MapPin } from "lucide-react";

interface Section {
  id: number;
  type: string;
  label: string;
  options?: string[] | null;
  required: boolean;
}

interface SectionValue {
  sectionId: number;
  value?: string | null;
  imageData?: string | null;
}

interface AssignmentData {
  assignment: { id: number };
  sections: Section[];
  values: SectionValue[];
}

function getQueryParams() {
  const search = window.location.search;
  const params = new URLSearchParams(search);
  return {
    identifier: params.get("identifier") ?? "",
    address: params.get("address") ?? "",
  };
}

export default function AssignmentLocation() {
  const { identifier, address } = getQueryParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [accessUnlocked, setAccessUnlocked] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const { data: passwordCheck } = useQuery<{ hasPassword: boolean }>({
    queryKey: ["/api/assignments/access-password/check"],
  });

  const apiUrl = `/api/assignments/keybunch?identifier=${encodeURIComponent(identifier)}&address=${encodeURIComponent(address)}`;
  const historyUrl = `/api/assignments/keybunch/history?identifier=${encodeURIComponent(identifier)}&address=${encodeURIComponent(address)}`;

  const { data: assignmentData, isLoading } = useQuery<AssignmentData>({
    queryKey: ["/api/assignments/keybunch", identifier, address],
    queryFn: () => fetch(apiUrl, { credentials: "include" }).then(r => r.json()),
    enabled: !!(identifier && address) && (accessUnlocked || !passwordCheck?.hasPassword),
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: historyData = [] } = useQuery<any[]>({
    queryKey: ["/api/assignments/keybunch", identifier, address, "history"],
    queryFn: () => fetch(historyUrl, { credentials: "include" }).then(r => r.json()),
    enabled: showHistory && !!(identifier && address) && (accessUnlocked || !passwordCheck?.hasPassword),
  });

  useEffect(() => {
    if (assignmentData) {
      const initial: Record<number, string> = {};
      assignmentData.sections.forEach(section => {
        const val = assignmentData.values.find(v => v.sectionId === section.id);
        initial[section.id] = val?.value ?? "";
      });
      setFormValues(initial);
      setIsDirty(false);
    }
  }, [assignmentData]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("PUT", `/api/assignments/keybunch?identifier=${encodeURIComponent(identifier)}&address=${encodeURIComponent(address)}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/keybunch", identifier, address] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments/keybunch", identifier, address, "history"] });
      toast({ title: "Saved", description: "Assignment instructions updated." });
      setIsDirty(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleChange(sectionId: number, value: string) {
    setFormValues(prev => ({ ...prev, [sectionId]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    if (!assignmentData) return;
    const values = assignmentData.sections.map(s => ({
      sectionId: s.id,
      value: formValues[s.id] ?? null,
    }));
    const changes = assignmentData.sections
      .map(s => {
        const oldVal = (assignmentData.values.find(v => v.sectionId === s.id)?.value) ?? "";
        const newVal = formValues[s.id] ?? "";
        if (oldVal !== newVal) return { sectionLabel: s.label, oldValue: oldVal, newValue: newVal };
        return null;
      })
      .filter(Boolean);
    saveMutation.mutate({ values, changes });
  }

  async function verifyPassword() {
    setCheckingPassword(true);
    setPasswordError("");
    try {
      const res = await apiRequest("POST", "/api/assignments/access-password/verify", { password: accessPassword });
      if (res.valid) {
        setAccessUnlocked(true);
      } else {
        setPasswordError("Incorrect password");
      }
    } catch {
      setPasswordError("Could not verify password");
    } finally {
      setCheckingPassword(false);
    }
  }

  if (!identifier || !address) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-gray-500">No key bunch specified.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/assignment-builder")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </div>
    );
  }

  // Password gate
  if (passwordCheck?.hasPassword && !accessUnlocked) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/assignment-builder")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-gray-400" />
              Enter Access Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">Assignment instructions are password-protected. Enter the company access password to continue.</p>
            <div>
              <Input
                type="password"
                placeholder="Access password"
                value={accessPassword}
                onChange={e => { setAccessPassword(e.target.value); setPasswordError(""); }}
                onKeyDown={e => e.key === "Enter" && verifyPassword()}
              />
              {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
            </div>
            <Button className="w-full" onClick={verifyPassword} disabled={checkingPassword || !accessPassword}>
              {checkingPassword ? "Checking…" : "Unlock"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/assignment-builder?tab=locations")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-700">{identifier}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Bunch {identifier}</h1>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-sm text-gray-500">{address}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="mr-1.5 h-4 w-4" />
            History
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Change History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyData.length === 0 && (
              <p className="text-sm text-gray-400">No changes recorded yet.</p>
            )}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {historyData.map((entry: any) => (
                <div key={entry.id} className="border-l-2 border-gray-200 pl-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{entry.editorName}</span>
                    <Badge variant="outline" className="text-xs capitalize">{entry.editorType}</Badge>
                    <Clock className="h-3 w-3 ml-1" />
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  {(entry.changes as any[]).map((change: any, i: number) => (
                    <div key={i} className="text-xs text-gray-700">
                      <span className="font-medium">{change.sectionLabel}:</span>{" "}
                      <span className="text-red-500 line-through">{change.oldValue || "(empty)"}</span>
                      {" → "}
                      <span className="text-green-600">{change.newValue || "(empty)"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {!isLoading && assignmentData?.sections.length === 0 && (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <p className="text-sm">No template sections defined yet.</p>
          <p className="text-xs mt-1">Go to the Assignment Builder to set up your template first.</p>
        </div>
      )}

      {!isLoading && assignmentData && assignmentData.sections.length > 0 && (
        <div className="space-y-6">
          {assignmentData.sections.map((section: Section) => (
            <div key={section.id}>
              {section.type === "divider" && <Separator />}
              {section.type === "heading" && (
                <h2 className="text-lg font-semibold text-gray-800 border-b pb-1">{section.label}</h2>
              )}
              {section.type === "text_input" && (
                <div>
                  <Label>
                    {section.label}
                    {section.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    className="mt-1"
                    value={formValues[section.id] ?? ""}
                    onChange={e => handleChange(section.id, e.target.value)}
                  />
                </div>
              )}
              {section.type === "textarea" && (
                <div>
                  <Label>
                    {section.label}
                    {section.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Textarea
                    className="mt-1 min-h-[100px] resize-y"
                    value={formValues[section.id] ?? ""}
                    onChange={e => handleChange(section.id, e.target.value)}
                  />
                </div>
              )}
              {section.type === "dropdown" && section.options && (
                <div>
                  <Label>
                    {section.label}
                    {section.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Select
                    value={formValues[section.id] ?? ""}
                    onValueChange={v => handleChange(section.id, v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {(section.options ?? []).map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {section.type === "image" && (
                <div>
                  <Label>
                    {section.label}
                    {section.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center">
                    {formValues[section.id] ? (
                      <div>
                        <img src={formValues[section.id]} alt={section.label} className="max-h-40 mx-auto rounded mb-2" />
                        <Button variant="ghost" size="sm" onClick={() => handleChange(section.id, "")}>Remove image</Button>
                      </div>
                    ) : (
                      <>
                        <label className="cursor-pointer">
                          <span className="text-sm text-blue-600">Click to upload image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => handleChange(section.id, ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG or GIF</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={!isDirty || saveMutation.isPending} size="lg">
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
