import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, User, MapPin, Clock, Edit, ArrowRight, Key, AlertTriangle, CheckCircle, RotateCcw, Eye, ImageIcon, FileText } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/ui/image-upload";
import DocumentUpload from "@/components/ui/document-upload";
import DocumentViewer from "@/components/ui/document-viewer";
import { AppSettings } from "@shared/settings";

const KeyHistory = () => {
  const [match, params] = useRoute("/key-history/:id");
  const [, setLocation] = useLocation();
  const keyBunchId = params?.id;
  const [actionFilter, setActionFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings, getTypeDisplayName, getStatusDisplayName, getTypeColor, getStatusColor, getActionDisplayName } = useSettingsHelpers();

  const { data: keyBunch, isLoading: keyBunchLoading } = useQuery({
    queryKey: ["/api/key-bunches", keyBunchId],
    queryFn: async () => {
      const response = await fetch(`/api/key-bunches/${keyBunchId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    enabled: !!keyBunchId,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/key-bunches", keyBunchId, "history"],
    queryFn: async () => {
      const response = await fetch(`/api/key-bunches/${keyBunchId}/history`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    enabled: !!keyBunchId,
  });

  // Sort movement history events by timestamp (audit_log entries removed - they're for system auditing, not user-facing history)
  const allEvents = [
    ...history.map((item: any) => ({ ...item, type: 'movement', timestamp: item.timestamp }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter events
  const filteredEvents = allEvents.filter((event: any) => {
    if (actionFilter !== "all" && event.action !== actionFilter) return false;
    
    if (timeFilter !== "all") {
      const eventDate = new Date(event.timestamp);
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      
      switch (timeFilter) {
        case "today":
          return eventDate.toDateString() === now.toDateString();
        case "week":
          return now.getTime() - eventDate.getTime() <= 7 * dayMs;
        case "month":
          return now.getTime() - eventDate.getTime() <= 30 * dayMs;
        default:
          return true;
      }
    }
    
    return true;
  });

  const getActionIcon = (action: string, type: string) => {
    switch (action) {
      case 'issue':
        return <ArrowRight className="h-4 w-4 text-orange-600" />;
      case 'return':
        return <RotateCcw className="h-4 w-4 text-green-600" />;
      case 'move':
        return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'status_change':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'audit_edit':
        return <Edit className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string, type: string) => {
    switch (action) {
      case 'issue':
        return 'bg-orange-100 border-orange-200';
      case 'return':
        return 'bg-green-100 border-green-200';
      case 'move':
        return 'bg-blue-100 border-blue-200';
      case 'status_change':
        return 'bg-yellow-100 border-yellow-200';
      case 'audit_edit':
        return 'bg-purple-100 border-purple-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  // Image update mutation
  const updateImageMutation = useMutation({
    mutationFn: async (imageUrl: string | null) => {
      return apiRequest("PATCH", `/api/key-bunches/${keyBunchId}`, {
        imageUrl: imageUrl || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", keyBunchId] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      toast({
        title: "Success",
        description: "Photo updated successfully"
      });
      setIsEditingImage(false);
    },
    onError: (error: any) => {
      console.error("Image upload error:", error);
      let errorMessage = "Failed to update photo";
      if (error.message?.includes("too large") || error.message?.includes("payload") || error.message?.includes("size")) {
        errorMessage = "Image is too large. Please choose a smaller image (max 5MB).";
      } else if (error.message) {
        errorMessage = `Failed to update photo: ${error.message}`;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsEditingImage(false);
    }
  });

  const handleImageChange = (imageUrl: string | null) => {
    // Check base64 size (rough estimate: base64 is ~1.37x larger than original)
    if (imageUrl && imageUrl.length > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image is too large. Please choose a smaller image (max 5MB).",
        variant: "destructive"
      });
      return;
    }
    updateImageMutation.mutate(imageUrl);
  };

  // Document update mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: { documentUrl: string | null; documentName: string | null; documentType: string | null }) => {
      return apiRequest("PATCH", `/api/key-bunches/${keyBunchId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", keyBunchId] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      toast({
        title: "Success",
        description: "Document updated successfully"
      });
      setIsEditingDocument(false);
    },
    onError: (error: any) => {
      console.error("Document upload error:", error);
      let errorMessage = "Failed to update document";
      if (error.message?.includes("too large") || error.message?.includes("payload") || error.message?.includes("size")) {
        errorMessage = "Document could not be uploaded. Please try a different file.";
      } else if (error.message) {
        errorMessage = `Failed to update document: ${error.message}`;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setIsEditingDocument(false);
    }
  });

  const handleDocumentChange = (data: { documentUrl: string | null; documentName: string | null; documentType: string | null }) => {
    updateDocumentMutation.mutate(data);
  };

  const formatActionDescription = (event: any) => {
    const userName = event.user?.firstName && event.user?.lastName 
      ? `${event.user.firstName} ${event.user.lastName}`
      : event.user?.email || 'Unknown';

    // Get action name for better matching
    const actionName = getActionDisplayName(event.action);
    
    // For audit edit actions, parse the notes for meaningful information
    if (actionName === 'Audit Edit' || event.action?.includes('audit') || event.notes?.includes('audit')) {
      if (event.notes) {
        // Check for audit completion message
        if (event.notes.includes('marked as present')) {
          return `Key scanned and marked as PRESENT during audit by ${userName}`;
        }
        if (event.notes.includes('marked as missing')) {
          // Extract reason if provided
          const reasonMatch = event.notes.match(/Reason: (.+)/);
          if (reasonMatch) {
            return `Key marked as MISSING during audit by ${userName}. Reason: ${reasonMatch[1]}`;
          }
          return `Key marked as MISSING during audit by ${userName}`;
        }
        // Generic notes display
        return `Notes: ${event.notes}`;
      }
      return `Updated during audit by ${userName}`;
    }

    switch (actionName) {
      case 'Issue':
        if (event.notes) {
          const purposeMatch = event.notes.match(/for (.+?)(\.|$)/);
          if (purposeMatch) {
            return `Issued by ${userName} for ${purposeMatch[1]}`;
          }
        }
        return `Issued by ${userName}`;
      case 'Return':
        return `Returned by ${userName}${event.newTag ? ` (New seal: ${event.newTag})` : ''}`;
      case 'Move':
        return `Moved from ${event.fromLocation?.name || 'Unknown'} to ${event.toLocation?.name || 'Unknown'} by ${userName}`;
      case 'Deleted':
        return `Key bunch deleted by ${userName}`;
      default:
        // Fallback to notes if available
        if (event.notes) {
          return event.notes;
        }
        return `${actionName} performed by ${userName}`;
    }
  };

  if (!match) return null;

  if (keyBunchLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/key-bunches")}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Keys
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Key History</h1>
            <p className="text-gray-600">Complete timeline for {keyBunch?.identifier}</p>
          </div>
        </div>

        {/* Key Bunch Info */}
        {keyBunch && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Key className="h-5 w-5 text-blue-600" />
                {keyBunch.identifier}
                <Badge variant="outline" className={getTypeColor(keyBunch.type)}>
                  {getTypeDisplayName(keyBunch.type)}
                </Badge>
                <Badge variant="outline" className={getStatusColor(keyBunch.status)}>
                  {getStatusDisplayName(keyBunch.status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Key Details Grid */}
                <div className="flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Current Location:</span>
                      <p className="text-gray-900">{keyBunch.location?.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Seal Reference:</span>
                      <p className="text-gray-900">{keyBunch.currentTag || 'Not assigned'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Keys/Fobs:</span>
                      <p className="text-gray-900">{keyBunch.keyCount} keys, {keyBunch.fobCount} fobs</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Last Updated:</span>
                      <p className="text-gray-900">{formatTimeAgo(keyBunch.lastUpdated)}</p>
                    </div>
                  </div>
                </div>
                
                {/* Image Section */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">Photo:</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingImage(!isEditingImage)}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {keyBunch.imageUrl ? 'Replace' : 'Add'}
                    </Button>
                  </div>
                  
                  {isEditingImage ? (
                    <div className="w-40">
                      <ImageUpload
                        imageUrl={keyBunch.imageUrl}
                        onImageChange={handleImageChange}
                        className="w-full"
                      />
                    </div>
                  ) : keyBunch.imageUrl ? (
                    <div>
                      <div 
                        className="relative cursor-pointer group"
                        onClick={() => setShowImagePreview(true)}
                      >
                        <img
                          src={keyBunch.imageUrl}
                          alt={`Photo of ${keyBunch.identifier}`}
                          className="w-32 h-24 object-cover rounded-lg border border-gray-300 shadow-sm group-hover:shadow-md transition-shadow"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all flex items-center justify-center">
                          <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mt-1">Click to enlarge</p>
                        {keyBunch.imageUpdatedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Photo added {formatTimeAgo(keyBunch.imageUpdatedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">No photo</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Document Section */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">Document:</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingDocument(!isEditingDocument)}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {keyBunch.documentUrl ? 'Replace' : 'Add'}
                    </Button>
                  </div>
                  
                  {isEditingDocument ? (
                    <div className="w-40">
                      <DocumentUpload
                        documentUrl={keyBunch.documentUrl}
                        documentName={keyBunch.documentName}
                        onDocumentChange={handleDocumentChange}
                        className="w-full"
                      />
                    </div>
                  ) : keyBunch.documentUrl ? (
                    <div>
                      <div 
                        className="relative cursor-pointer group p-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        onClick={() => setShowDocumentViewer(true)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {keyBunch.documentName || "Document"}
                            </p>
                            <p className="text-xs text-gray-500">Click to view</p>
                          </div>
                          <Eye className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        </div>
                      </div>
                      <div className="text-center">
                        {keyBunch.documentUploadedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Uploaded {formatTimeAgo(keyBunch.documentUploadedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">No document</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {keyBunch.notes && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium text-blue-800">Notes:</span>
                  <p className="text-blue-700 mt-1">{keyBunch.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="issue">Key Issues</SelectItem>
                    <SelectItem value="return">Key Returns</SelectItem>
                    <SelectItem value="move">Location Moves</SelectItem>
                    <SelectItem value="status_change">Status Changes</SelectItem>
                    <SelectItem value="audit_edit">Audit Edits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline ({filteredEvents.length} events)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No events found matching your criteria
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event: any, index: number) => (
                  <div key={`${event.type}-${event.id}-${index}`} className="relative">
                    {/* Timeline line */}
                    {index < filteredEvents.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-200"></div>
                    )}
                    
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getActionColor(event.action, event.type)}`}>
                        {getActionIcon(event.action, event.type)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">
                                  {getActionDisplayName(event.action)}
                                </span>
                                <Badge variant="outline" className="text-xs">Movement</Badge>
                              </div>
                              
                              <p className="text-gray-700 mb-2">
                                {formatActionDescription(event)}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                                </div>
                                {event.user && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {event.user.email}
                                  </div>
                                )}
                                {event.fromLocation && event.toLocation && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {event.fromLocation.name} → {event.toLocation.name}
                                  </div>
                                )}
                              </div>
                              
                              {/* Additional details */}
                              {event.details && Object.keys(event.details).length > 0 && (
                                <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                                  <strong>Details:</strong>
                                  <pre className="mt-1 whitespace-pre-wrap text-gray-600">
                                    {JSON.stringify(event.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full-screen Image Preview Modal */}
      {keyBunch?.imageUrl && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="max-w-4xl w-[95vw] h-[90vh]">
            <DialogHeader>
              <DialogTitle>Photo of {keyBunch.identifier}</DialogTitle>
              <DialogDescription>
                Full-size preview of the key bunch photo. Click anywhere to close.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={keyBunch.imageUrl}
                alt={`Full size photo of ${keyBunch.identifier}`}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={() => setShowImagePreview(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Document Viewer Modal */}
      {keyBunch?.documentUrl && (
        <Dialog open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
          <DialogContent className="max-w-6xl w-full sm:w-[95vw] h-[95vh] sm:h-[90vh] p-3 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="text-base sm:text-lg line-clamp-1">
                {keyBunch.documentName || "Document"}
              </DialogTitle>
              <DialogDescription className="hidden sm:block">
                Attached document for {keyBunch?.identifier}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden" style={{ height: 'calc(95vh - 80px)' }}>
              <DocumentViewer 
                documentUrl={keyBunch.documentUrl}
                documentName={keyBunch.documentName || undefined}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default KeyHistory;