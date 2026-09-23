import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Download, Printer, MapPin, Settings, Plus, Trash2, Save } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Available columns for export
const AVAILABLE_COLUMNS = [
  { id: 'locationName', label: 'Location Name', default: true },
  { id: 'locationType', label: 'Location Type', default: true },
  { id: 'keyIdentifier', label: 'Key Set ID', default: true },
  { id: 'keyType', label: 'Key Type', default: true },
  { id: 'currentTag', label: 'Seal', default: true },
  { id: 'keyCount', label: 'Keys', default: true },
  { id: 'fobCount', label: 'Fobs', default: true },
  { id: 'keyDescription', label: 'Description', default: false },
  { id: 'address', label: 'Address', default: false },
  { id: 'notes', label: 'Notes', default: false },
];

const LocationReport = () => {
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportDescription, setNewReportDescription] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.filter(col => col.default).map(col => col.id)
  );
  const { settings, getTypeDisplayName, getStatusDisplayName, getTypeColor, getStatusColor } = useSettingsHelpers();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: keyBunches = [] } = useQuery({
    queryKey: ["/api/key-bunches"],
  });

  const { data: savedReports = [] } = useQuery({
    queryKey: ["/api/saved-reports"],
    enabled: !!user,
  });

  const { data: recentMovements = [] } = useQuery({
    queryKey: ["/api/movement-history", { limit: 20 }],
    queryFn: async () => {
      const response = await fetch("/api/movement-history?limit=20", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  const selectedLocation = locations.find((l: any) => l.id === parseInt(selectedLocationId));
  const locationKeys = selectedLocationId 
    ? keyBunches.filter((bunch: any) => bunch.locationId === parseInt(selectedLocationId))
    : [];

  const keyTypes = settings?.keyTypes || [];
  const statuses = settings?.statuses || [];
  
  const locationStats = selectedLocationId ? {
    total: locationKeys.length,
    typeBreakdown: keyTypes.reduce((acc: any, type: any) => {
      acc[type.id] = locationKeys.filter((k: any) => k.type === type.id).length;
      return acc;
    }, {}),
    statusBreakdown: statuses.reduce((acc: any, status: any) => {
      acc[status.id] = locationKeys.filter((k: any) => k.status === status.id).length;
      return acc;
    }, {}),
  } : null;

  const locationMovements = selectedLocationId 
    ? recentMovements.filter((m: any) => 
        m.fromLocationId === parseInt(selectedLocationId) || 
        m.toLocationId === parseInt(selectedLocationId)
      ).slice(0, 10)
    : [];

  // Permission checks
  const canManageReports = user?.role === 'admin' || user?.role === 'super_admin';

  // Mutations
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating report with data:", data);
      return apiRequest("POST", "/api/saved-reports", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-reports"] });
      toast({ title: "Report created successfully" });
      setCreateReportOpen(false);
      setNewReportName("");
      setNewReportDescription("");
      // Reset columns to defaults
      setSelectedColumns(AVAILABLE_COLUMNS.filter(col => col.default).map(col => col.id));
    },
    onError: (error: any) => {
      console.error("Failed to create report:", error);
      toast({ 
        title: "Failed to create report", 
        description: error?.message || "Unknown error",
        variant: "destructive" 
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/saved-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-reports"] });
      toast({ title: "Report deleted successfully" });
      setSelectedReportId("");
    },
    onError: () => {
      toast({ title: "Failed to delete report", variant: "destructive" });
    },
  });

  // Handlers
  const handleCreateReport = () => {
    if (!newReportName.trim()) {
      toast({ title: "Please enter a report name", variant: "destructive" });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({ title: "Please select at least one column", variant: "destructive" });
      return;
    }

    createReportMutation.mutate({
      name: newReportName,
      description: newReportDescription,
      reportConfig: {
        selectedLocation: selectedLocationId,
        columns: selectedColumns,
      },
    });
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    
    // Apply the saved report configuration
    if (reportId) {
      const report = savedReports.find((r: any) => r.id === parseInt(reportId));
      if (report && report.reportConfig) {
        const config = report.reportConfig;
        
        // Apply saved columns
        if (config.columns && Array.isArray(config.columns)) {
          setSelectedColumns(config.columns);
        }
        
        // Apply saved location if it exists
        if (config.selectedLocation) {
          setSelectedLocationId(config.selectedLocation);
        }
      }
    }
  };

  const handleDeleteReport = () => {
    if (!selectedReportId) return;
    if (confirm("Are you sure you want to delete this saved report?")) {
      deleteReportMutation.mutate(parseInt(selectedReportId));
    }
  };

  const handleToggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleExportCustom = () => {
    if (selectedColumns.length === 0) {
      toast({ title: "Please select at least one column to export", variant: "destructive" });
      return;
    }

    // Build CSV with selected columns only
    const headers: string[] = [];
    const columnMap: { [key: string]: string } = {};
    
    selectedColumns.forEach(colId => {
      const column = AVAILABLE_COLUMNS.find(c => c.id === colId);
      if (column) {
        headers.push(column.label);
        columnMap[colId] = column.label;
      }
    });

    const csvRows = [headers.join(',')];
    
    // Add data rows with only selected columns
    for (const location of locations) {
      const locationKeyBunches = keyBunches.filter((kb: any) => kb.locationId === location.id && !kb.isDeleted);
      
      if (locationKeyBunches.length === 0) {
        // Location with no keys
        const row: string[] = [];
        selectedColumns.forEach(colId => {
          if (colId === 'locationName') row.push(`"${location.name}"`);
          else if (colId === 'locationType') row.push(`"${location.type}"`);
          else row.push('');
        });
        csvRows.push(row.join(','));
      } else {
        // Location with keys
        for (const kb of locationKeyBunches) {
          const row: string[] = [];
          selectedColumns.forEach(colId => {
            switch (colId) {
              case 'locationName':
                row.push(`"${location.name}"`);
                break;
              case 'locationType':
                row.push(`"${location.type}"`);
                break;
              case 'keyIdentifier':
                row.push(`"${kb.identifier}"`);
                break;
              case 'keyType':
                row.push(`"${getTypeDisplayName(kb.type)}"`);
                break;
              case 'currentTag':
                row.push(`"${kb.currentTag || ''}"`);
                break;
              case 'keyCount':
                row.push(String(kb.keyCount || 0));
                break;
              case 'fobCount':
                row.push(String(kb.fobCount || 0));
                break;
              case 'keyDescription':
                row.push(`"${(kb.keyDescription || '').replace(/"/g, '""')}"`);
                break;
              case 'address':
                row.push(`"${(kb.address || '').replace(/"/g, '""')}"`);
                break;
              case 'notes':
                row.push(`"${(kb.notes || '').replace(/"/g, '""')}"`);
                break;
              default:
                row.push('');
            }
          });
          csvRows.push(row.join(','));
        }
      }
    }
    
    // Download CSV
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const reportName = selectedReportId 
      ? savedReports.find((r: any) => r.id === parseInt(selectedReportId))?.name || 'custom-report'
      : 'custom-report';
    
    a.download = `${reportName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Custom export completed successfully" });
  };

  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/locations/export", {
        credentials: "include",
      });
      
      if (!response.ok) {
        // Try to get error message from response
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Export failed");
        }
        throw new Error(`Export failed with status ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-locations-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Export completed successfully" });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({ 
        title: "Failed to export locations", 
        description: error.message || "Unknown error occurred",
        variant: "destructive" 
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!selectedLocation || !locationKeys.length) return;

    const csvContent = [
      ["Key ID", "Identifier", "Type", "Status", "Seal", "Description", "Last Updated"].join(","),
      ...locationKeys.map((key: any) => [
        key.id,
        key.identifier,
        getTypeDisplayName(key.type),
        getStatusDisplayName(key.status),
        key.currentTag || "None",
        key.description || "",
        new Date(key.updatedAt || key.createdAt).toLocaleDateString()
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedLocation.name.replace(/\s+/g, '_')}_keys_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/locations'}
            >
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Location Report</h1>
              <p className="text-gray-600">Detailed key inventory and activity report by location</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {selectedLocationId && (
              <>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer size={16} className="mr-2" />
                  Print
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download size={16} className="mr-2" />
                  Export CSV
                </Button>
              </>
            )}
            {canManageReports && (
              <Button variant="outline" onClick={handleExportAll} data-testid="button-export-all">
                <Download size={16} className="mr-2" />
                Export All Locations
              </Button>
            )}
          </div>
        </div>

        {/* Reports Management Section */}
        {canManageReports && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Saved Reports</span>
                <Dialog open={createReportOpen} onOpenChange={setCreateReportOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-create-report">
                      <Plus size={16} className="mr-2" />
                      Create Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Custom Report</DialogTitle>
                      <DialogDescription>
                        Save a custom report with selected columns for quick exports.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reportName">Report Name *</Label>
                        <Input
                          id="reportName"
                          value={newReportName}
                          onChange={(e) => setNewReportName(e.target.value)}
                          placeholder="e.g., Daily Van Report"
                          data-testid="input-report-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reportDescription">Description</Label>
                        <Textarea
                          id="reportDescription"
                          value={newReportDescription}
                          onChange={(e) => setNewReportDescription(e.target.value)}
                          placeholder="Optional description for this report"
                          data-testid="input-report-description"
                        />
                      </div>
                      <div>
                        <Label className="mb-3 block">Columns to Include in Export *</Label>
                        <div className="border rounded-md p-4 space-y-2 bg-gray-50">
                          {AVAILABLE_COLUMNS.map((column) => (
                            <div key={column.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`col-${column.id}`}
                                checked={selectedColumns.includes(column.id)}
                                onChange={() => handleToggleColumn(column.id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                data-testid={`checkbox-column-${column.id}`}
                              />
                              <label 
                                htmlFor={`col-${column.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {column.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Selected: {selectedColumns.length} column{selectedColumns.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateReportOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreateReport} disabled={createReportMutation.isPending} data-testid="button-save-report">
                        <Save size={16} className="mr-2" />
                        {createReportMutation.isPending ? "Saving..." : "Save Report"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Select value={selectedReportId} onValueChange={handleSelectReport}>
                      <SelectTrigger className="w-full" data-testid="select-saved-report">
                        <SelectValue placeholder="Select a saved report..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedReports.length === 0 && (
                          <div className="p-4 text-sm text-gray-500 text-center">
                            No saved reports yet. Create one to get started!
                          </div>
                        )}
                        {savedReports.map((report: any) => (
                          <SelectItem key={report.id} value={report.id.toString()} data-testid={`saved-report-${report.id}`}>
                            <div>
                              <div className="font-medium">{report.name}</div>
                              {report.description && (
                                <div className="text-xs text-gray-500">{report.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedReportId && (
                    <>
                      <Button
                        variant="default"
                        onClick={handleExportCustom}
                        title="Export with selected columns"
                        data-testid="button-export-custom"
                      >
                        <Download size={16} className="mr-2" />
                        Export Report
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleDeleteReport}
                        disabled={deleteReportMutation.isPending}
                        title="Delete selected report"
                        data-testid="button-delete-report"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Show selected columns */}
                {selectedReportId && selectedColumns.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Columns included in this report:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedColumns.map(colId => {
                        const column = AVAILABLE_COLUMNS.find(c => c.id === colId);
                        return column ? (
                          <Badge key={colId} variant="secondary" className="bg-blue-100 text-blue-800">
                            {column.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Location</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a location to generate report" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location: any) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    <div className="flex items-center gap-2">
                      {location.type === "van" ? <MapPin size={16} /> : <FileText size={16} />}
                      {location.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedLocation && locationStats && (
          <>
            {/* Location Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {selectedLocation.type === "van" ? <MapPin size={20} /> : <FileText size={20} />}
                    {selectedLocation.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <strong>Type:</strong> {selectedLocation.type === "van" ? "Mobile Unit" : "Office Location"}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Description:</strong> {selectedLocation.description}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Status:</strong> 
                      <Badge variant="outline" className="ml-2">
                        {selectedLocation.status}
                      </Badge>
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Report Generated:</strong> {new Date().toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{locationStats.total}</div>
                      <div className="text-xs text-gray-500">Total Keys</div>
                    </div>
                    {statuses.map((status: any, index: number) => {
                      const colors = ['text-green-600', 'text-orange-600', 'text-red-600', 'text-purple-600'];
                      return (
                        <div key={status.id}>
                          <div className={`text-2xl font-bold ${colors[index % colors.length]}`}>
                            {locationStats.statusBreakdown[status.id] || 0}
                          </div>
                          <div className="text-xs text-gray-500">{status.displayName}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Type Distribution */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Key Distribution by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`grid grid-cols-${Math.min(keyTypes.length, 4)} gap-4`}>
                  {keyTypes.map((keyType: any, index: number) => {
                    const colors = ['text-blue-600', 'text-purple-600', 'text-orange-600', 'text-green-600'];
                    return (
                      <div key={keyType.id} className="text-center">
                        <div className={`text-xl font-bold ${colors[index % colors.length]}`}>
                          {locationStats.typeBreakdown[keyType.id] || 0}
                        </div>
                        <div className="text-sm text-gray-600">{keyType.displayName}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Key Inventory Table */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Key Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Identifier</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Seal</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locationKeys.map((key: any) => (
                        <tr key={key.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{key.identifier}</td>
                          <td className="p-2">
                            <Badge className={getTypeColor(key.type)}>
                              {getTypeDisplayName(key.type)}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Badge className={getStatusColor(key.status)}>
                              {getStatusDisplayName(key.status)}
                            </Badge>
                          </td>
                          <td className="p-2">
                            {key.currentTag ? (
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {key.currentTag}
                              </code>
                            ) : (
                              <span className="text-gray-400 text-xs">No seal</span>
                            )}
                          </td>
                          <td className="p-2 text-gray-600">{key.keyDescription || "—"}</td>
                          <td className="p-2 text-blue-600">{key.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {locationMovements.length > 0 ? (
                  <div className="space-y-3">
                    {locationMovements.map((movement: any) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">
                            {movement.action === "location_move" ? "Key Movement" : movement.action}
                          </p>
                          <p className="text-xs text-gray-600">
                            {movement.keyBunch?.identifier} - {movement.notes || "No notes"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatTimeAgo(new Date(movement.timestamp))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedLocationId && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Location</h3>
              <p className="text-gray-600">Choose a location from the dropdown above to generate a detailed report</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LocationReport;