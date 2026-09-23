import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Move, Users, Search, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@shared/permissions";
import { NFCBulkAuditScanner } from "@/components/nfc-bulk-audit-scanner";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const BulkMoveKeys = () => {
  const [keyType, setKeyType] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [showAuditInterface, setShowAuditInterface] = useState(false);
  const [currentAuditSession, setCurrentAuditSession] = useState<any>(null);
  const [auditCheckedKeys, setAuditCheckedKeys] = useState<{ [key: number]: boolean }>({});
  const [auditMode, setAuditMode] = useState<'manual' | 'nfc'>('manual');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { settings, getTypeDisplayName, getStatusDisplayName, getTypeColor, getStatusColor, typesMatch } = useSettingsHelpers();

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: keyBunches = [] } = useQuery({
    queryKey: ["/api/key-bunches"],
  });

  // Get keys for audit location
  const { data: auditLocationKeys = [] } = useQuery({
    queryKey: ["/api/key-bunches", "location", fromLocation],
    queryFn: async () => {
      if (!fromLocation) return [];
      return (keyBunches as any[]).filter((kb: any) => kb.locationId === parseInt(fromLocation));
    },
    enabled: !!fromLocation && showAuditInterface,
  });

  // Check for recent audit verification
  const { data: auditVerification } = useQuery({
    queryKey: ["/api/audit/verification", fromLocation],
    queryFn: async () => {
      if (!fromLocation) return null;
      const response = await fetch(`/api/audit/verification/${fromLocation}`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!fromLocation,
  });

  // Calculate available keys at selected location
  const availableKeys = keyType && fromLocation 
    ? (keyBunches as any[]).filter((bunch: any) => 
        typesMatch(bunch.type, keyType) && 
        bunch.locationId === parseInt(fromLocation)
      ).length
    : 0;

  // Check if user has permission to bulk move keys
  if (!can(PERMISSIONS.KEY_BULK_MOVE)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to bulk move keys.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.href = '/locations'}
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Locations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ type, fromId, toId }: { type: string; fromId: string; toId: string }) => {
      // Check audit verification first
      if (!auditVerification?.isVerified) {
        throw new Error("A completed audit is required before bulk moving keys. Please complete an audit for this location first.");
      }

      const targetBunches = (keyBunches as any[]).filter((bunch: any) => 
        typesMatch(bunch.type, type) && bunch.locationId === parseInt(fromId)
      );
      
      if (targetBunches.length === 0) {
        throw new Error(`No ${getTypeDisplayName(type)} keys found at selected location`);
      }

      // Move each key bunch individually
      const promises = targetBunches.map((bunch: any) => 
        apiRequest("POST", `/api/key-bunches/${bunch.id}/move`, {
          fromLocationId: parseInt(fromId),
          toLocationId: parseInt(toId),
          fromBunchType: type,
          notes: `Bulk move: All ${getTypeDisplayName(type)} keys moved from ${(locations as any[]).find((l: any) => l.id === parseInt(fromId))?.name} to ${(locations as any[]).find((l: any) => l.id === parseInt(toId))?.name} (Audit verified: ${auditVerification.lastAuditDate})`,
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${availableKeys} keys moved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      // Reset form
      setKeyType("");
      setFromLocation("");
      setToLocation("");
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to move keys",
        variant: "destructive",
      });
    },
  });

  // Start audit session
  const startAuditMutation = useMutation({
    mutationFn: async () => {
      const expectedCount = auditLocationKeys.length;
      const response = await apiRequest("POST", "/api/audit/start", {
        totalExpected: expectedCount,
      });
      return response;
    },
    onSuccess: (session) => {
      setCurrentAuditSession(session);
      setShowAuditInterface(true);
      toast({
        title: "Audit Started",
        description: `Audit session created for ${auditLocationKeys.length} keys`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start audit",
        variant: "destructive",
      });
    },
  });

  // Complete audit session
  const completeAuditMutation = useMutation({
    mutationFn: async () => {
      const checkedCount = Object.values(auditCheckedKeys).filter(Boolean).length;
      const missingKeys = auditLocationKeys
        .filter((key: any) => !auditCheckedKeys[key.id])
        .map((key: any) => key.id);

      await apiRequest("POST", `/api/audit/${currentAuditSession.id}/complete`, {
        totalScanned: checkedCount,
        missingBunches: missingKeys,
        notes: `Audit completed for bulk move - ${checkedCount}/${auditLocationKeys.length} keys present`,
      });
    },
    onSuccess: () => {
      setShowAuditInterface(false);
      setCurrentAuditSession(null);
      setAuditCheckedKeys({});
      queryClient.invalidateQueries({ queryKey: ["/api/audit/verification", fromLocation] });
      toast({
        title: "Audit Completed",
        description: "Location audit completed successfully. You can now proceed with bulk move.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete audit",
        variant: "destructive",
      });
    },
  });

  const handleExecuteMove = () => {
    if (!keyType || !fromLocation || !toLocation || fromLocation === toLocation) return;
    
    bulkMoveMutation.mutate({ 
      type: keyType, 
      fromId: fromLocation, 
      toId: toLocation 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/locations'}
            className="w-fit sm:w-auto"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bulk Move Keys</h1>
            <p className="text-sm sm:text-base text-gray-600">Move all keys of a specific type from one location to another</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Move size={18} className="sm:w-5 sm:h-5" />
                  Move Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
                <div>
                  <Label htmlFor="keyType">Key Type</Label>
                  <Select value={keyType} onValueChange={setKeyType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select key type to move" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings?.keyTypes?.filter((t: any) => t.isActive).map((type: any) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fromLocation">From Location</Label>
                  <Select value={fromLocation} onValueChange={setFromLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source location" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations as any[]).map((location: any) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="toLocation">To Location</Label>
                  <Select value={toLocation} onValueChange={setToLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination location" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations as any[]).map((location: any) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {keyType && fromLocation && toLocation && (
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">Move Summary</h3>
                      <p className="text-blue-800 text-sm">
                        Moving {availableKeys} {getTypeDisplayName(keyType)} keys from{" "}
                        {(locations as any[]).find((l: any) => l.id === parseInt(fromLocation))?.name} to{" "}
                        {(locations as any[]).find((l: any) => l.id === parseInt(toLocation))?.name}
                      </p>
                    </div>

                    {/* Audit Verification Status */}
                    {fromLocation && (
                      <div className={`p-4 rounded-lg ${
                        auditVerification?.isVerified 
                          ? "bg-green-50 border border-green-200" 
                          : "bg-red-50 border border-red-200"
                      }`}>
                        <h3 className={`font-medium mb-2 ${
                          auditVerification?.isVerified ? "text-green-900" : "text-red-900"
                        }`}>
                          Audit Verification Status
                        </h3>
                        {auditVerification?.isVerified ? (
                          <div className="text-green-800 text-sm">
                            <p>✓ Audit completed {auditVerification.hoursSinceAudit} hours ago</p>
                            <p>Bulk move authorized (valid for 24 hours)</p>
                          </div>
                        ) : (
                          <div className="text-red-800 text-sm">
                            <p>⚠ {auditVerification?.message || "No recent audit found"}</p>
                            <p>Audits must be completed within 24 hours for bulk moves</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => startAuditMutation.mutate()}
                              disabled={!fromLocation || startAuditMutation.isPending}
                            >
                              {startAuditMutation.isPending ? "Starting..." : "Start Audit"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Audit Interface */}
                    {showAuditInterface && currentAuditSession && (
                      <Card className="mt-4 border-blue-200 bg-blue-50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-blue-900">
                            <Search size={20} />
                            Audit in Progress
                          </CardTitle>
                          <p className="text-sm text-blue-700">
                            Verify keys at {(locations as any[]).find((l: any) => l.id === parseInt(fromLocation))?.name}
                          </p>
                          
                          {/* Audit Mode Selection - Mobile Optimized */}
                          <div className="mt-3">
                            <span className="text-sm font-medium text-blue-800 block mb-2 sm:mb-3">Audit Mode:</span>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                              <Button
                                variant={auditMode === 'manual' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAuditMode('manual')}
                                className="h-10 sm:h-8 text-xs sm:text-sm"
                              >
                                📋 Manual Checklist
                              </Button>
                              <Button
                                variant={auditMode === 'nfc' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAuditMode('nfc')}
                                className="h-10 sm:h-8 text-xs sm:text-sm"
                              >
                                📱 NFC Scanning
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {auditMode === 'manual' ? (
                            <>
                              {/* Manual Checklist Mode - Mobile Optimized */}
                              <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
                                {auditLocationKeys.map((key: any) => (
                                  <div key={key.id} className="flex items-start sm:items-center justify-between p-3 sm:p-4 bg-white rounded-lg border hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                      <Checkbox
                                        checked={auditCheckedKeys[key.id] || false}
                                        onCheckedChange={(checked: boolean) => {
                                          setAuditCheckedKeys(prev => ({
                                            ...prev,
                                            [key.id]: checked
                                          }));
                                        }}
                                        className="mt-1 sm:mt-0 flex-shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm sm:text-base truncate">{key.identifier}</div>
                                        <div className="text-xs sm:text-sm text-gray-600 mt-1">
                                          Seal: {key.currentTag} • Fobs: {key.fobCount || 0}
                                        </div>
                                        {/* Mobile: Show badges below on mobile */}
                                        <div className="flex items-center gap-1 mt-2 sm:hidden">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(key.type)}`}>
                                            {getTypeDisplayName(key.type)}
                                          </span>
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(key.status)}`}>
                                            {key.status === 'active' ? 'Present' : key.status}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Desktop: Show badges on the right */}
                                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-3">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(key.type)}`}>
                                        {getTypeDisplayName(key.type)}
                                      </span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(key.status)}`}>
                                        {key.status === 'active' ? 'Present' : key.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {/* NFC Scanning Mode */}
                              <NFCBulkAuditScanner
                                auditSession={currentAuditSession}
                                expectedKeys={auditLocationKeys}
                                onScanSuccess={(keyBunch: any) => {
                                  setAuditCheckedKeys(prev => ({
                                    ...prev,
                                    [keyBunch.id]: true
                                  }));
                                }}
                              />
                            </>
                          )}
                          
                          <div className="mt-4 p-3 sm:p-4 bg-white rounded-lg border">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="text-sm sm:text-base">
                                <strong>Progress:</strong> {Object.values(auditCheckedKeys).filter(Boolean).length} of {auditLocationKeys.length} keys {auditMode === 'manual' ? 'checked' : 'scanned'}
                              </div>
                              <Button
                                onClick={() => completeAuditMutation.mutate()}
                                disabled={completeAuditMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm"
                              >
                                {completeAuditMutation.isPending ? "Completing..." : "Complete Audit"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <Button 
                  onClick={handleExecuteMove}
                  disabled={
                    !keyType || 
                    !fromLocation || 
                    !toLocation || 
                    fromLocation === toLocation || 
                    availableKeys === 0 ||
                    bulkMoveMutation.isPending ||
                    showAuditInterface ||
                    !auditVerification?.isVerified
                  }
                  className="w-full h-12 sm:h-11 text-sm sm:text-base"
                  size="lg"
                >
                  {bulkMoveMutation.isPending ? "Moving Keys..." : 
                   showAuditInterface ? "Complete Audit First" :
                   !auditVerification?.isVerified ? "Audit Required Before Move" :
                   `Execute Move (${availableKeys} keys)`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status Panel */}
          <div>
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Users size={18} className="sm:w-5 sm:h-5" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {keyType && fromLocation ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{availableKeys}</div>
                      <div className="text-sm text-gray-600">
                        {getTypeDisplayName(keyType)} keys available
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      <p>Location: {(locations as any[]).find((l: any) => l.id === parseInt(fromLocation))?.name}</p>
                      <p>Type: {getTypeDisplayName(keyType)}</p>
                    </div>

                    {availableKeys === 0 && (
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          No {getTypeDisplayName(keyType)} keys found at this location
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <p className="text-sm">Select key type and location to see available keys</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkMoveKeys;