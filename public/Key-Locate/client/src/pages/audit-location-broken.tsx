import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Search, CheckCircle, AlertCircle, MapPin, Square, Edit, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getBunchTypeName, getBunchTypeColor, getStatusColor, formatTimeAgo } from "@/lib/utils";
import { NFCAuditScanner } from "@/components/nfc-audit-scanner";

const AuditLocation = () => {
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedKeyType, setSelectedKeyType] = useState("all");
  const [expectedCount, setExpectedCount] = useState("");
  const [auditSession, setAuditSession] = useState<any>(null);
  const [checkedBunches, setCheckedBunches] = useState<Set<number>>(new Set());
  const [editingBunch, setEditingBunch] = useState<number | null>(null);
  const [editingData, setEditingData] = useState({ currentTag: "", keyCount: 0, fobCount: 0 });
  const [useNFCMode, setUseNFCMode] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const { data: keyBunches = [] } = useQuery({
    queryKey: ["/api/key-bunches"],
  });

  const selectedLocation = locations.find((l: any) => l.id === parseInt(selectedLocationId));
  const locationKeys = selectedLocationId 
    ? keyBunches.filter((bunch: any) => {
        const matchesLocation = bunch.locationId === parseInt(selectedLocationId);
        const matchesType = selectedKeyType === "all" || bunch.type === selectedKeyType;
        return matchesLocation && matchesType;
      })
    : [];

  const startAuditMutation = useMutation({
    mutationFn: async ({ locationId, expectedCount }: { locationId: string; expectedCount: string }) => {
      const response = await apiRequest("POST", "/api/audit/start", {
        performedBy: 1, // TODO: Get from auth context
        totalExpected: parseInt(expectedCount),
        notes: `Location audit for ${selectedLocation?.name}`,
      });
      console.log("API Response:", response);
      return response;
    },
    onSuccess: (session) => {
      console.log("Audit session created successfully:", session);
      if (session && session.id) {
        setAuditSession(session);
        setCheckedBunches(new Set());
        queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
        toast({
          title: "Audit Started",
          description: `Audit session ${session.id} created for ${selectedLocation?.name}`,
        });
      } else {
        console.error("Invalid session data received:", session);
        toast({
          title: "Error",
          description: "Failed to create audit session - invalid response",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Start audit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start audit session",
        variant: "destructive",
      });
    },
  });

  const updateKeyBunchMutation = useMutation({
    mutationFn: ({ bunchId, updates }: { bunchId: number; updates: any }) =>
      apiRequest("PATCH", `/api/key-bunches/${bunchId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      toast({ title: "Success", description: "Key bunch updated successfully" });
      setEditingBunch(null);
      setEditingData({ currentTag: "", keyCount: 0, fobCount: 0 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update key bunch", variant: "destructive" });
    },
  });

  const completeAuditMutation = useMutation({
    mutationFn: async () => {
      console.log("Completing audit, session:", auditSession);
      console.log("Current checkedBunches:", checkedBunches);
      console.log("Location keys:", locationKeys);
      
      if (!auditSession?.id) {
        console.error("No audit session found. Session state:", auditSession);
        throw new Error("No active audit session found");
      }
      
      // Mark unchecked bunches as missing
      const uncheckedBunches = locationKeys.filter((bunch: any) => !checkedBunches.has(bunch.id));
      
      // Update status for missing bunches
      for (const bunch of uncheckedBunches) {
        await apiRequest("PATCH", `/api/key-bunches/${bunch.id}`, { status: "missing" });
      }
      
      // Complete audit session
      return apiRequest("PATCH", `/api/audit/sessions/${auditSession.id}`, {
        status: "completed",
        endTime: new Date().toISOString(),
        notes: `Location audit completed. Found ${checkedBunches.size} of ${locationKeys.length} keys, ${uncheckedBunches.length} marked as missing.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/active"] });
      
      const missingCount = locationKeys.length - checkedBunches.size;
      toast({
        title: "Audit Completed",
        description: `Found ${checkedBunches.size} keys, ${missingCount} marked as missing`,
      });
      // Reset state
      setAuditSession(null);
      setCheckedBunches(new Set());
      setSelectedLocationId("");
      setExpectedCount("");
    },
    onError: (error: any) => {
      console.error("Audit completion error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete audit session",
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

  const handleCompleteAudit = () => {
    console.log("=== AUDIT COMPLETION DEBUG ===");
    console.log("Current auditSession state:", auditSession);
    console.log("Session ID:", auditSession?.id);
    console.log("Session type:", typeof auditSession);
    console.log("Current checkedBunches:", checkedBunches);
    console.log("Location keys count:", locationKeys.length);
    console.log("===============================");
    
    if (!auditSession || !auditSession.id) {
      console.error("No audit session found. Session state:", auditSession);
      toast({ 
        title: "Error", 
        description: `No active audit session found. Session: ${JSON.stringify(auditSession)}`, 
        variant: "destructive" 
      });
      return;
    }
    
    console.log("Proceeding with audit completion for session:", auditSession.id);
    completeAuditMutation.mutate();
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
          <h1 className="text-2xl font-bold text-gray-900">Audit Location</h1>
          <p className="text-gray-600">Perform a comprehensive key audit for a specific location</p>
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
                      {locations.map((location: any) => (
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
                        <SelectItem value="day_shift">Day Shift Keys</SelectItem>
                        <SelectItem value="night_shift">Night Shift Keys</SelectItem>
                        <SelectItem value="lock_ups">Lock Ups Keys</SelectItem>
                        <SelectItem value="static">Static Keys</SelectItem>
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
                        <div>Day Shift: <strong>{locationKeys.filter(k => k.type === "day_shift").length}</strong></div>
                        <div>Night Shift: <strong>{locationKeys.filter(k => k.type === "night_shift").length}</strong></div>
                        <div>Lock Ups: <strong>{locationKeys.filter(k => k.type === "lock_ups").length}</strong></div>
                        <div>Static: <strong>{locationKeys.filter(k => k.type === "static").length}</strong></div>
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
                    setCheckedBunches(prev => new Set([...prev, keyBunch.id]));
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
                                    <Badge className={getBunchTypeColor(bunch.type)}>
                                      {getBunchTypeName(bunch.type)}
                                    </Badge>
                                    <Badge className={getStatusColor(bunch.status)}>
                                      {bunch.status}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLocation;
                    </div>
                  )}
                </CardContent>
              </Card>
                                {editingBunch === bunch.id ? (
                                  <div className="mt-2 space-y-2">
                                    <div className="flex gap-2">
                                      <Input
                                        placeholder="Tag"
                                        value={editingData.currentTag}
                                        onChange={(e) => setEditingData({...editingData, currentTag: e.target.value})}
                                        className="h-8 text-xs"
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Keys"
                                        value={editingData.keyCount}
                                        onChange={(e) => setEditingData({...editingData, keyCount: parseInt(e.target.value) || 0})}
                                        className="h-8 text-xs w-20"
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Fobs"
                                        value={editingData.fobCount}
                                        onChange={(e) => setEditingData({...editingData, fobCount: parseInt(e.target.value) || 0})}
                                        className="h-8 text-xs w-20"
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      <Button size="sm" onClick={handleSaveEdit} className="h-7 px-2">
                                        <Save size={12} />
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingBunch(null)} className="h-7 px-2">
                                        <X size={12} />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-sm text-gray-700 mt-1">
                                      Seal: {bunch.currentTag || "No seal"}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {bunch.keyCount} keys, {bunch.fobCount} fobs
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${getBunchTypeColor(bunch.type)}`}
                                      >
                                        {getBunchTypeName(bunch.type)}
                                      </Badge>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${getStatusColor(bunch.status)}`}
                                      >
                                        {bunch.status}
                                      </Badge>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {editingBunch !== bunch.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditBunch(bunch)}
                                    className="h-8 px-2"
                                  >
                                    <Edit size={12} />
                                  </Button>
                                )}

                                {checkedBunches.has(bunch.id) && (
                                  <CheckCircle className="text-green-600" size={20} />
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setAuditSession(null);
                        setCheckedBunches(new Set());
                      }}
                      className="w-full sm:w-auto"
                    >
                      Cancel Audit
                    </Button>
                    <Button 
                      onClick={handleCompleteAudit}
                      disabled={completeAuditMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      <Square className="mr-2" size={16} />
                      <span className="hidden sm:inline">
                        {completeAuditMutation.isPending ? "Completing..." : `Complete Audit (${auditProgress?.remaining || 0} missing)`}
                      </span>
                      <span className="sm:hidden">
                        {completeAuditMutation.isPending ? "Completing..." : `Complete (${auditProgress?.remaining || 0})`}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Panel */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Audit Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  {auditProgress && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {auditProgress.completion}%
                        </div>
                        <div className="text-sm text-gray-600">Complete</div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Checked:</span>
                          <strong className="text-green-600">{auditProgress.checked}</strong>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <strong>{auditProgress.total}</strong>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Missing:</span>
                          <strong className="text-red-600">{auditProgress.remaining}</strong>
                        </div>
                      </div>

                      <Progress value={auditProgress.completion} className="w-full" />

                      {auditProgress.completion === 100 && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 text-green-800">
                            <CheckCircle size={16} />
                            <span className="text-sm font-medium">All keys checked!</span>
                          </div>
                        </div>
                      )}

                      {auditProgress.remaining > 0 && (
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-800">
                            <AlertCircle size={16} />
                            <span className="text-sm font-medium">
                              {auditProgress.remaining} keys will be marked as missing
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>1. Check each key bunch that is physically present</p>
                    <p>2. Use the edit button to update seals, keys, or fobs if needed</p>
                    <p>3. Any unchecked keys will be marked as missing</p>
                    <p>4. Click "Complete Audit" when finished</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Session Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Location:</strong> {selectedLocation?.name}
                    </div>
                    <div>
                      <strong>Started:</strong> {formatTimeAgo(new Date(auditSession.createdAt))}
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
    </div>
  );
};

export default AuditLocation;