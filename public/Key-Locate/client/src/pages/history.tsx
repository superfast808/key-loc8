import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  RotateCcw, 
  ClipboardCheck, 
  Download, 
  User, 
  Clock, 
  Tag, 
  MapPin,
  Calendar,
  Trash2
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@shared/permissions";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const History = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [limit, setLimit] = useState(50);
  const { can } = usePermissions();
  const { settings, getTypeDisplayName, getActionDisplayName } = useSettingsHelpers();

  // Resolves any action string (canonical or custom company ID) to its canonical name
  const normalizeAction = (action: string) => {
    if (!action || !settings?.actions) return action || "";
    const a = (settings.actions as any[]).find((t: any) => t.id === action);
    return a?.name || action;
  };

  // Check if user has permission to view history
  if (!can(PERMISSIONS.HISTORY_VIEW)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view key movement history.</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: movementHistory = [], isLoading } = useQuery({
    queryKey: ["/api/movement-history", { limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());
      
      const response = await fetch(`/api/movement-history?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  // Apply filters on the frontend
  const filteredHistory = movementHistory.filter((movement: any) => {
    // Type filter
    if (typeFilter !== "all" && normalizeAction(movement.action) !== typeFilter) {
      return false;
    }
    
    // Search filter - comprehensive search across all audit data
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      
      // Search in basic fields
      const basicFieldsMatch = 
        movement.keyBunch?.identifier?.toLowerCase().includes(searchLower) ||
        movement.notes?.toLowerCase().includes(searchLower) ||
        movement.fromLocation?.name?.toLowerCase().includes(searchLower) ||
        movement.toLocation?.name?.toLowerCase().includes(searchLower) ||
        movement.action?.toLowerCase().includes(searchLower) ||
        movement.user?.username?.toLowerCase().includes(searchLower) ||
        movement.user?.email?.toLowerCase().includes(searchLower) ||
        movement.user?.firstName?.toLowerCase().includes(searchLower) ||
        movement.user?.lastName?.toLowerCase().includes(searchLower);
      
      // Search in audit log details (for audit_log source entries)
      let detailsMatch = false;
      if (movement.source === 'audit_log' && movement.details) {
        try {
          const details = typeof movement.details === 'string' ? JSON.parse(movement.details) : movement.details;
          const detailsString = JSON.stringify(details).toLowerCase();
          detailsMatch = detailsString.includes(searchLower);
        } catch (e) {
          detailsMatch = movement.details.toLowerCase().includes(searchLower);
        }
      }
      
      if (!basicFieldsMatch && !detailsMatch) return false;
    }
    
    // Date filter
    if (dateFilter) {
      const movementDate = new Date(movement.timestamp).toISOString().split('T')[0];
      if (movementDate !== dateFilter) return false;
    }
    
    return true;
  });

  const getMovementIcon = (action: string) => {
    switch (normalizeAction(action)) {
      case "location_move":
      case "move":
        return <ArrowRight className="text-primary" size={20} />;
      case "status_change":
        return <RotateCcw className="text-yellow-600" size={20} />;
      case "audit_edit":
        return <ClipboardCheck className="text-green-600" size={20} />;
      case "issue":
        return <User className="text-blue-600" size={20} />;
      case "return":
        return <User className="text-green-600" size={20} />;
      case "deleted":
        return <Trash2 className="text-red-600" size={20} />;
      default:
        return <ArrowRight className="text-gray-600" size={20} />;
    }
  };

  const getMovementBgColor = (action: string) => {
    switch (normalizeAction(action)) {
      case "move":
        return "bg-blue-100";
      case "status_change":
        return "bg-yellow-100";
      case "audit_edit":
        return "bg-green-100";
      case "issue":
        return "bg-purple-100";
      case "return":
        return "bg-emerald-100";
      case "deleted":
        return "bg-red-100";
      default:
        return "bg-gray-100";
    }
  };

  const getMovementTitle = (movement: any) => {
    switch (normalizeAction(movement.action)) {
      case "move":
        return "Key Movement";
      case "status_change":
        return "Status Change";
      case "audit_edit":
        return "Audit Edit";
      case "issue":
        return "Key Issue";
      case "return":
        return "Key Return";
      case "deleted":
        return "Key Deleted";
      case "key_created":
        return "Key Created";
      case "location_created":
        return "Location Created";
      case "location_updated":
        return "Location Updated";
      case "location_deleted":
        return "Location Deleted";
      case "user_login":
        return "User Login";
      case "user_logout":
        return "User Logout";
      case "setting_updated":
        return "Settings Updated";
      case "bulk_operation":
        return "Bulk Operation";
      default:
        return movement.action ? getActionDisplayName(movement.action) : "System Activity";
    }
  };

  const getMovementDescription = (movement: any) => {
    const identifier = movement.keyBunch?.identifier || movement.keyBunchId || 'Unknown';
    
    // Handle audit_log entries (with details field)
    if (movement.source === 'audit_log' && movement.details) {
      try {
        const details = typeof movement.details === 'string' ? JSON.parse(movement.details) : movement.details;
        
        switch (normalizeAction(movement.action)) {
          case "key_created":
            return `New key bunch "${details.identifier}" created`;
          case "location_created":
            return `New location "${details.name}" created`;
          case "location_updated":
            return `Location "${details.name || 'Unknown'}" updated`;
          case "location_deleted":
            return `Location "${details.name || 'Unknown'}" deleted`;
          case "user_login":
            return `User logged in`;
          case "setting_updated":
            return `Settings updated: ${details.category || 'System'}`;
          default:
            return details.description || JSON.stringify(details);
        }
      } catch (e) {
        return movement.details || 'System activity';
      }
    }
    
    // Handle movement_history entries (traditional format)
    switch (normalizeAction(movement.action)) {
      case "move":
        if (movement.fromLocation && movement.toLocation) {
          return `${identifier} moved from ${movement.fromLocation.name} to ${movement.toLocation.name}`;
        }
        return `${identifier} relocated`;
      case "status_change":
        return `${identifier} status changed${movement.notes ? `: ${movement.notes}` : ''}`;
      case "audit_edit":
        return `${identifier} updated during audit${movement.notes ? `: ${movement.notes}` : ''}`;
      case "issue":
        return `${identifier} issued${movement.notes ? `: ${movement.notes}` : ''}`;
      case "return":
        return `${identifier} returned${movement.notes ? `: ${movement.notes}` : ''}`;
      case "deleted":
        return `${identifier} permanently deleted${movement.notes ? `: ${movement.notes}` : ''}`;
      default:
        return `Activity recorded${movement.notes ? `: ${movement.notes}` : ''}`;
    }
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ["Date", "Time", "Type", "Key Bunch", "Description", "User", "Notes"];
    const csvContent = [
      headers.join(","),
      ...filteredHistory.map((movement: any) => {
        const date = new Date(movement.timestamp);
        return [
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          movement.action,
          movement.keyBunch?.identifier || movement.keyBunchId || "",
          getMovementDescription(movement).replace(/,/g, ";"),
          movement.user?.username || movement.userId || "",
          (movement.notes || "").replace(/,/g, ";")
        ].join(",");
      })
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `key-movement-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const loadMore = () => {
    setLimit(prev => prev + 50);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
            <CardTitle>Movement History</CardTitle>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[180px]"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <optgroup label="Key Operations">
                    <SelectItem value="key_created">Key Created</SelectItem>
                    <SelectItem value="move">Move</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="status_change">Status Change</SelectItem>
                    <SelectItem value="audit_edit">Audit Edit</SelectItem>
                    <SelectItem value="deleted">Deleted</SelectItem>
                  </optgroup>
                  <optgroup label="Location Operations">
                    <SelectItem value="location_created">Location Created</SelectItem>
                    <SelectItem value="location_updated">Location Updated</SelectItem>
                    <SelectItem value="location_deleted">Location Deleted</SelectItem>
                  </optgroup>
                  <optgroup label="System Events">
                    <SelectItem value="user_login">User Login</SelectItem>
                    <SelectItem value="setting_updated">Settings Updated</SelectItem>
                    <SelectItem value="bulk_operation">Bulk Operation</SelectItem>
                  </optgroup>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2" size={16} />
                Export
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Input
              placeholder="Search by key bunch ID, location, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClipboardCheck className="mx-auto mb-4 text-gray-300" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Movement History</h3>
              <p>No movements found matching your criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredHistory.map((movement: any) => (
                <div key={movement.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 ${getMovementBgColor(movement.action)} rounded-full flex items-center justify-center`}>
                        {getMovementIcon(movement.action)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Enhanced audit details for deleted keys */}
                      {movement.action === "deleted" ? (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <h4 className="text-sm font-medium text-red-900 mb-2">Deletion Audit Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-red-800">
                            <div className="flex items-center space-x-2">
                              <User className="h-3 w-3" />
                              <span>Deleted by: {movement.user?.firstName || movement.userId || 'System'} {movement.user?.lastName || ''}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>Deleted: {new Date(movement.timestamp).toLocaleString()}</span>
                            </div>
                            {movement.keyBunch && (
                              <>
                                <div className="flex items-center space-x-2">
                                  <Tag className="h-3 w-3" />
                                  <span>Seal: {movement.keyBunch.currentTag || 'No seal'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="h-3 w-3 bg-red-600 rounded-full"></span>
                                  <span>Keys: {movement.keyBunch.keyCount || 1} | Fobs: {movement.keyBunch.fobCount || 0}</span>
                                </div>
                                {movement.keyBunch.keyDescription && (
                                  <div className="flex items-center space-x-2 md:col-span-2">
                                    <span className="h-3 w-3 bg-red-400 rounded-full"></span>
                                    <span>Description: {movement.keyBunch.keyDescription}</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-3 w-3" />
                                  <span>Last Location: {movement.fromLocation?.name || 'Unknown'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge className="h-3 w-3" />
                                  <span>Type: {getTypeDisplayName(movement.keyBunch.type)}</span>
                                </div>
                                {movement.keyBunch.nfcSerial && (
                                  <div className="flex items-center space-x-2 md:col-span-2">
                                    <span className="h-3 w-3 bg-blue-500 rounded-full"></span>
                                    <span>NFC Serial: {movement.keyBunch.nfcSerial}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {movement.notes && movement.notes.includes('Reason:') && (
                              <div className="md:col-span-2 mt-1 pt-2 border-t border-red-300">
                                <span className="font-medium">Reason: </span>
                                <span>{movement.notes.split('Reason:')[1]?.trim() || movement.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : normalizeAction(movement.action) === "audit_edit" ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900">
                                {getMovementTitle(movement)}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Key bunch: {movement.keyBunch?.identifier || movement.keyBunchId || 'Unknown'}
                              </p>
                            </div>
                            <span className="text-sm text-gray-500 whitespace-nowrap">
                              {formatTimeAgo(movement.timestamp)}
                            </span>
                          </div>
                          
                          {/* Audit Edit Changes Display */}
                          {movement.notes && (
                            <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="text-xs font-medium text-purple-900 mb-2 flex items-center">
                                <ClipboardCheck className="h-3 w-3 mr-1" />
                                Changes Made:
                              </h4>
                              <div className="text-sm text-purple-800">
                                {movement.notes.replace('Key details updated: ', '').split(', ').map((change: string, idx: number) => (
                                  <div key={idx} className="flex items-center space-x-2 py-1">
                                    <span className="text-purple-600">•</span>
                                    <span className="font-medium">{change}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
                            {movement.user && (
                              <span className="flex items-center">
                                <User className="mr-1" size={12} />
                                {movement.user.firstName} {movement.user.lastName}
                              </span>
                            )}
                            <span className="flex items-center">
                              <Clock className="mr-1" size={12} />
                              {new Date(movement.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(movement.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                            {movement.keyBunch?.currentTag && (
                              <span className="flex items-center">
                                <Tag className="mr-1" size={12} />
                                {movement.keyBunch.currentTag}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">
                                {getMovementTitle(movement)}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {getMovementDescription(movement)}
                              </p>
                            </div>
                            <span className="text-sm text-gray-500 whitespace-nowrap">
                              {formatTimeAgo(movement.timestamp)}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            {movement.user && (
                              <span className="flex items-center">
                                <User className="mr-1" size={12} />
                                {movement.user.firstName && movement.user.lastName ? `${movement.user.firstName} ${movement.user.lastName}` : movement.user.username}
                              </span>
                            )}
                            <span className="flex items-center">
                              <Clock className="mr-1" size={12} />
                              {new Date(movement.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(movement.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                            {movement.keyBunch?.currentTag && (
                              <span className="flex items-center">
                                <Tag className="mr-1" size={12} />
                                {movement.keyBunch.currentTag}
                              </span>
                            )}
                            {movement.toLocation && (
                              <span className="flex items-center">
                                <MapPin className="mr-1" size={12} />
                                {movement.toLocation.name}
                              </span>
                            )}
                            {movement.keyBunch?.type && (
                              <Badge className={`${getTypeDisplayName(movement.keyBunch.type) === "Day Shift" ? "bg-blue-100 text-blue-800" : 
                                getTypeDisplayName(movement.keyBunch.type) === "Night Shift" ? "bg-purple-100 text-purple-800" : 
                                "bg-green-100 text-green-800"} text-xs px-2 py-1`}>
                                {getTypeDisplayName(movement.keyBunch.type)}
                              </Badge>
                            )}
                          </div>
                          
                          {movement.notes && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                              <strong>Notes:</strong> {movement.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredHistory.length > 0 && movementHistory.length >= limit && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Showing {filteredHistory.length} of {movementHistory.length} results
                </p>
                <Button variant="outline" onClick={loadMore}>
                  Load more history
                </Button>
              </div>
            </div>
          )}
          
          {filteredHistory.length > 0 && movementHistory.length < limit && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-700 text-center">
                Showing all {filteredHistory.length} result{filteredHistory.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default History;
