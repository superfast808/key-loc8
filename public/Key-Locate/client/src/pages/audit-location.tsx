import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, CheckCircle, AlertCircle, MapPin, Square, Edit, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTimeAgo } from "@/lib/utils";
import { NFCAuditScanner } from "@/components/nfc-audit-scanner";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const AuditLocation = () => {
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedKeyType, setSelectedKeyType] = useState("all");
  const [expectedCount, setExpectedCount] = useState("");
  const [auditSession, setAuditSession] = useState<any>(null);
  const [checkedBunches, setCheckedBunches] = useState<Set<number>>(new Set());
  const [editingBunch, setEditingBunch] = useState<number | null>(null);
  const [editingData, setEditingData] = useState({ currentTag: "", keyCount: 0, fobCount: 0 });
  const [useNFCMode, setUseNFCMode] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [missingKeyReasons, setMissingKeyReasons] = useState<Record<number, string>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings, getTypeDisplayName, getStatusDisplayName, getTypeColor, getStatusColor, typesMatch } = useSettingsHelpers();

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: keyBunches = [] } = useQuery({
    queryKey: ["/api/key-bunches"],
  });

  const selectedLocation = (locations as any[]).find((l: any) => l.id === parseInt(selectedLocationId));
  const locationKeys = selectedLocationId 
    ? (keyBunches as any[]).filter((bunch: any) => {
        const matchesLocation = bunch.locationId === parseInt(selectedLocationId);
        const matchesType = selectedKeyType === "all" || typesMatch(bunch.type, selectedKeyType);
        // Exclude bunches with 0 keys AND 0 fobs - they cannot be audited
        // Use explicit numeric comparison to handle null/undefined/string values
        // Treat invalid/NaN values as 0 to avoid including corrupted data in audits
        const keyCount = Number.isFinite(Number(bunch.keyCount)) ? Number(bunch.keyCount) : 0;
        const fobCount = Number.isFinite(Number(bunch.fobCount)) ? Number(bunch.fobCount) : 0;
        const hasPhysicalItems = keyCount > 0 || fobCount > 0;
        return matchesLocation && matchesType && hasPhysicalItems;
      })
    : [];

  const startAuditMutation = useMutation({
    mutationFn: async ({ locationId, expectedCount }: { locationId: string; expectedCount: string }) => {
      const response = await apiRequest("POST", "/api/audit/start", {
        performedBy: 1,
        totalExpected: parseInt(expectedCount),
        notes: `Location audit for ${selectedLocation?.name}`,
      });
      return response;
    },
    onSuccess: (session) => {
      if (session && session.id) {
        setAuditSession(session);
        setCheckedBunches(new Set());
        queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
        toast({
          title: "Audit Started",
          description: `Audit session ${session.id} created for ${selectedLocation?.name}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start audit session",
        variant: "destructive",
      });
    },
  });

  const completeAuditMutation = useMutation({
    mutationFn: async () => {
      if (!auditSession?.id) throw new Error("No audit session");
      
      const missingKeys = locationKeys.filter((key: any) => !checkedBunches.has(key.id));
      const presentKeys = locationKeys.filter((key: any) => checkedBunches.has(key.id));
      
      // Build missing keys data with reasons
      const missingKeysData = missingKeys.map((key: any) => ({
        id: key.id,
        reason: missingKeyReasons[key.id] || ""
      }));
      
      // Build present keys data (for manual checklist mode)
      const presentKeysData = presentKeys.map((key: any) => ({
        id: key.id
      }));
      
      // Complete endpoint handles ALL status updates (Present + Missing)
      // Sends presentKeys for manual checklist mode, backend also checks NFC scans
      await apiRequest("POST", `/api/audit/${auditSession.id}/complete`, {
        totalScanned: checkedBunches.size,
        notes: `Audit completed with ${checkedBunches.size}/${locationKeys.length} keys present`,
        presentKeys: presentKeysData,
        missingKeys: missingKeysData
      });
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Audit Completed",
        description: `Audit session completed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      setAuditSession(null);
      setCheckedBunches(new Set());
      setShowConfirmDialog(false);
      setMissingKeyReasons({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete audit",
        variant: "destructive",
      });
    },
  });

  const updateKeyBunchMutation = useMutation({
    mutationFn: async ({ bunchId, updates }: { bunchId: number; updates: any }) => {
      return apiRequest("PATCH", `/api/key-bunches/${bunchId}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "Key Bunch Updated",
        description: "Key bunch details have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      setEditingBunch(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update key bunch",
        variant: "destructive",
      });
    },
  });

  const handleStartAudit = () => {
    if (!selectedLocationId) return;
    startAuditMutation.mutate({ 
      locationId: selectedLocationId, 
      expectedCount: locationKeys.length.toString()
    });
  };

  const handleBunchCheck = (bunchId: number, checked: boolean) => {
    setCheckedBunches(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(bunchId);
      } else {
        newSet.delete(bunchId);
      }
      return newSet;
    });
  };

  const handleEditBunch = (bunch: any) => {
    setEditingBunch(bunch.id);
    setEditingData({
      currentTag: bunch.currentTag || "",
      keyCount: bunch.keyCount || 0,
      fobCount: bunch.fobCount || 0
    });
  };

  const handleSaveEdit = () => {
    if (editingBunch) {
      updateKeyBunchMutation.mutate({
        bunchId: editingBunch,
        updates: editingData
      });
    }
  };

  const handleCompleteAudit = async () => {
    if (!auditSession || !auditSession.id) {
      toast({ 
        title: "Error", 
        description: "No active audit session found", 
        variant: "destructive" 
      });
      return;
    }
    
    const missingKeys = locationKeys.filter((key: any) => !checkedBunches.has(key.id));
    
    if (missingKeys.length > 0) {
      // Pre-fill reasons with existing key bunch notes
      const reasons: Record<number, string> = {};
      missingKeys.forEach((key: any) => {
        if (key.notes && key.notes.trim()) {
          reasons[key.id] = key.notes.trim();
        }
      });
      
      setMissingKeyReasons(reasons);
      setShowConfirmDialog(true);
    } else {
      // No missing keys, complete directly
      completeAuditMutation.mutate();
    }
  };

  const auditProgress = auditSession ? {
    checked: checkedBunches.size,
    total: locationKeys.length,
    remaining: locationKeys.length - checkedBunches.size,
    completion: Math.round((checkedBunches.size / locationKeys.length) * 100)
  } : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Location Audit</h1>
          <p className="text-gray-600">Perform a comprehensive key audit for a business location</p>
        </div>

        {!auditSession ? (
          // Audit Setup
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search size={20} />
                  Setup Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="location">Location to Audit</Label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations as any[]).map((location: any) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} />
                            {location.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLocationId && (
                  <div>
                    <Label htmlFor="keyType">Filter by Key Type</Label>
                    <Select value={selectedKeyType} onValueChange={setSelectedKeyType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select key type to audit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Key Types</SelectItem>
                        {settings?.keyTypes?.filter((t: any) => t.isActive).map((type: any) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium mb-1">Ready to audit</p>
                  <p className="text-xs text-blue-600">
                    This will show all {locationKeys.length} key bunches at this location for you to check off as present.
                    {selectedKeyType !== "all" && (
                      <span className="block mt-1 font-medium">
                        Filtering by: {selectedKeyType.replace('_', ' ')} keys only
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Audit Mode</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="radio"
                        id="manual-mode"
                        name="audit-mode"
                        checked={!useNFCMode}
                        onChange={() => setUseNFCMode(false)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="manual-mode" className="text-sm">Manual Checklist</Label>
                      <input
                        type="radio"
                        id="nfc-mode"
                        name="audit-mode"
                        checked={useNFCMode}
                        onChange={() => setUseNFCMode(true)}
                        className="h-4 w-4 ml-4"
                      />
                      <Label htmlFor="nfc-mode" className="text-sm">NFC Scanning</Label>
                    </div>
                  </div>

                  <Button 
                    onClick={handleStartAudit}
                    disabled={!selectedLocationId || locationKeys.length === 0 || startAuditMutation.isPending}
                    className="w-full"
                  >
                    {startAuditMutation.isPending ? "Starting..." : `Start ${useNFCMode ? 'NFC' : 'Manual'} Audit (${locationKeys.length} keys)`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedLocation && (
              <Card>
                <CardHeader>
                  <CardTitle>Location Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium">{selectedLocation.name}</h3>
                      <p className="text-sm text-gray-600">{selectedLocation.description}</p>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Current Inventory</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Total Keys: <strong>{locationKeys.length}</strong></div>
                        {(settings?.keyTypes ?? [])
                          .filter((t: any) => t.isActive)
                          .map((t: any) => {
                            const count = locationKeys.filter((k: any) => typesMatch(k.type, t.id)).length;
                            return (
                              <div key={t.id}>
                                {t.displayName}: <strong>{count}</strong>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Active Audit
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {useNFCMode ? (
              // NFC Audit Mode
              <div className="lg:col-span-2">
                <NFCAuditScanner
                  auditSession={auditSession}
                  expectedKeys={locationKeys}
                  onScanSuccess={(keyBunch) => {
                    setCheckedBunches(prev => new Set([...Array.from(prev), keyBunch.id]));
                  }}
                  onComplete={handleCompleteAudit}
                />
              </div>
            ) : (
              // Manual Checklist Mode
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle size={20} />
                      Key Bunches Checklist
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Check each key bunch that is physically present at {selectedLocation?.name}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {locationKeys.map((bunch: any) => (
                        <div
                          key={bunch.id}
                          className={`p-4 border rounded-md transition-colors ${
                            checkedBunches.has(bunch.id) 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`bunch-${bunch.id}`}
                              checked={checkedBunches.has(bunch.id)}
                              onCheckedChange={(checked) => handleBunchCheck(bunch.id, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <label 
                                    htmlFor={`bunch-${bunch.id}`}
                                    className="font-medium cursor-pointer"
                                  >
                                    {bunch.identifier}
                                  </label>
                                  <div className="text-sm text-gray-500 mt-1">
                                    Seal: {bunch.currentTag} • {bunch.keyCount || 1} key{(bunch.keyCount || 1) !== 1 ? 's' : ''}
                                    {bunch.fobCount > 0 && `, ${bunch.fobCount} fob${bunch.fobCount !== 1 ? 's' : ''}`}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className={getTypeColor(bunch.type)}>
                                      {getTypeDisplayName(bunch.type)}
                                    </Badge>
                                    <Badge className={getStatusColor(bunch.status)}>
                                      {getStatusDisplayName(bunch.status)}
                                    </Badge>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditBunch(bunch)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <Edit size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sidebar - Progress and Actions */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle size={20} />
                    Audit Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditProgress && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {auditProgress.checked}/{auditProgress.total}
                        </div>
                        <div className="text-sm text-gray-600">Keys Checked</div>
                      </div>
                      
                      <Progress value={auditProgress.completion} className="w-full" />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{auditProgress.checked}</div>
                          <div className="text-gray-500">Present</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-orange-600">{auditProgress.remaining}</div>
                          <div className="text-gray-500">Remaining</div>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleCompleteAudit}
                        disabled={completeAuditMutation.isPending}
                        className="w-full"
                        variant={auditProgress.completion === 100 ? "default" : "outline"}
                      >
                        {completeAuditMutation.isPending ? "Completing..." : "Complete Audit"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Session Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Location:</strong> {selectedLocation?.name}
                    </div>
                    <div>
                      <strong>Started:</strong> {auditSession.startTime ? formatTimeAgo(new Date(auditSession.startTime)) : "Just now"}
                    </div>
                    <div>
                      <strong>Session ID:</strong> 
                      <code className="ml-1 text-xs">{auditSession.id}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      
      {/* Confirmation Dialog for Missing Keys */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Missing Keys</DialogTitle>
            <DialogDescription>
              The following keys were not found during the audit. Please confirm they are definitely missing and optionally provide a reason for each.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {locationKeys
              .filter((key: any) => !checkedBunches.has(key.id))
              .map((key: any) => (
                <div key={key.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{key.identifier}</div>
                      <div className="text-sm text-gray-600">
                        <Badge variant="secondary" className="mr-2">
                          {getTypeDisplayName(key.type)}
                        </Badge>
                        {key.keyCount} key{key.keyCount !== 1 ? 's' : ''} 
                        {key.fobCount > 0 && `, ${key.fobCount} fob${key.fobCount !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`reason-${key.id}`} className="text-sm text-gray-600">
                      Reason (optional but encouraged)
                    </Label>
                    <Textarea
                      id={`reason-${key.id}`}
                      value={missingKeyReasons[key.id] || ""}
                      onChange={(e) => setMissingKeyReasons(prev => ({
                        ...prev,
                        [key.id]: e.target.value
                      }))}
                      placeholder="e.g., Last seen on Tuesday, Officer reported lost..."
                      className="mt-1"
                      rows={2}
                      data-testid={`textarea-missing-reason-${key.id}`}
                    />
                  </div>
                </div>
              ))}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setMissingKeyReasons({});
              }}
              data-testid="button-cancel-confirm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => completeAuditMutation.mutate()}
              disabled={completeAuditMutation.isPending}
              data-testid="button-confirm-complete"
            >
              {completeAuditMutation.isPending ? "Completing..." : "Confirm & Complete Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLocation;