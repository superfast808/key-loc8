import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, ArrowLeft, Key, LogOut, History, Upload, RotateCcw, ArrowUp, ArrowDown, Lock, MapPin, Briefcase } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import { useLocation, Link } from "wouter";
import KeyBunchForm from "@/components/forms/key-bunch-form";
import MoveKeyForm from "@/components/forms/move-key-form";
import KeyDetailsForm from "@/components/forms/key-details-form";
import KeyIssueForm from "@/components/forms/key-issue-form";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { useLoneWorking } from "@/hooks/useLoneWorking";


const KeyBunches = () => {
  const [location, navigate] = useLocation();
  const { settings, getTypeDisplayName, getStatusDisplayName, getLocationTypeDisplayName, getTypeColor, getStatusColor, typesMatch } = useSettingsHelpers();
  const { user } = useAuth();
  const { hasModule } = useModules();
  const { data: lwStatus } = useLoneWorking();

  // ─── Lone Working gate ───────────────────────────────────────────────────────
  const lwEnabled = hasModule("lone_working");
  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";
  const lwAssignments = lwStatus?.assignments ?? [];
  const hasLwAssignments = lwAssignments.length > 0;
  const activeCheckIn = lwStatus?.activeCheckIn;

  // Find the job for the active check-in
  const activeJobAssignment = activeCheckIn
    ? lwAssignments.find((a: any) => a.jobId === activeCheckIn.jobId)
    : null;
  const activeJob = activeJobAssignment?.job;
  const isStaticJob = activeJob?.jobType === "static";
  const staticLocationId = isStaticJob && activeJob?.locationId ? activeJob.locationId : null;

  // Non-admin LW workers without an active check-in cannot view keys
  const lwBlocked = lwEnabled && !isAdmin && hasLwAssignments && !activeCheckIn;

  // Get initial filters from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const [searchTerm, setSearchTerm] = useState(urlParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState(urlParams.get("type") || "all");
  const [locationFilter, setLocationFilter] = useState(urlParams.get("location") || urlParams.get("locationId") || "all");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || "all");
  const [showDeleted, setShowDeleted] = useState(false);

  // Check URL parameters for initial filters when location changes
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    const statusParam = urlParams.get('status');
    const allStatusIds = settings?.statuses?.map((s: any) => s.id) || [];
    if (statusParam && allStatusIds.includes(statusParam)) {
      setStatusFilter(statusParam);
    }
    
    const typeParam = urlParams.get('type');
    const allTypeIds = settings?.keyTypes?.map((t: any) => t.id) || [];
    if (typeParam && allTypeIds.includes(typeParam)) {
      setTypeFilter(typeParam);
    }
    
    const locationParam = urlParams.get('location') || urlParams.get('locationId');
    if (locationParam) {
      setLocationFilter(locationParam);
    }
  }, [location, settings]);
  const [showForm, setShowForm] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);

  const [editingSet, setEditingSet] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  
  const [showScrollButtons, setShowScrollButtons] = useState(false);

  // Scroll button handlers
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  // Show scroll buttons when user scrolls (desktop only)
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollButtons(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: allKeySets = [], isLoading } = useQuery({
    queryKey: ["/api/keys/list"],
    queryFn: async () => {
      const response = await fetch("/api/keys/list", { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      return response.json();
    },
  });

  const { data: deletedKeys = [] } = useQuery({
    queryKey: ["/api/key-bunches/deleted/all"],
    enabled: showDeleted,
    queryFn: async () => {
      const response = await fetch(`/api/key-bunches/deleted/all`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch deleted keys");
      return response.json();
    },
  });

  // For static LW workers, force the location filter to their job's location.
  // If the static job has NO location linked, use "-1" (matches nothing) so no keys are shown.
  const effectiveLocationFilter = (lwEnabled && !isAdmin && activeCheckIn && isStaticJob)
    ? (staticLocationId ? String(staticLocationId) : "-1")
    : locationFilter;

  // Filter sets client-side to prevent search input re-rendering issues
  const keySets = useMemo(() => {
    let filtered = allKeySets;
    
    if (typeFilter !== "all") {
      filtered = filtered.filter((set: any) => typesMatch(set.type, typeFilter));
    }
    
    if (effectiveLocationFilter !== "all") {
      filtered = filtered.filter((set: any) => set.locationId === parseInt(effectiveLocationFilter));
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((set: any) => set.status === statusFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((set: any) => {
        const locationsList = locations as any[];
        const location = locationsList.find((l: any) => l.id === set.locationId);
        const locationName = location?.name?.toLowerCase() || '';
        
        return set.identifier.toLowerCase().includes(term) ||
          (set.currentTag && set.currentTag.toLowerCase().includes(term)) ||
          (set.address && set.address.toLowerCase().includes(term)) ||
          (set.keyDescription && set.keyDescription.toLowerCase().includes(term)) ||
          locationName.includes(term) ||
          (set.notes && set.notes.toLowerCase().includes(term));
      });
    }
    
    // Sort by identifier first (using natural/numerical sort), then by type alphabetically
    filtered = filtered.sort((a: any, b: any) => {
      // Parse identifier into structured data: base number, suffix segments, tail
      const parseIdentifier = (id: string) => {
        const trimmed = id.trim();
        
        // Extract leading digits as base number
        const baseMatch = trimmed.match(/^(\d+)/);
        const base = baseMatch ? parseInt(baseMatch[1], 10) : null;
        
        // Extract hyphen-separated numeric suffixes
        const suffix: number[] = [];
        let remainder = trimmed;
        
        if (base !== null) {
          remainder = trimmed.slice(baseMatch![0].length);
        }
        
        // Parse "-123-456" style suffixes
        const suffixRegex = /-(\d+)/g;
        let match;
        while ((match = suffixRegex.exec(remainder)) !== null) {
          suffix.push(parseInt(match[1], 10));
        }
        
        // Everything else is the tail (non-numeric parts)
        const tail = remainder.replace(/-\d+/g, '');
        
        return { base, suffix, tail };
      };
      
      const parsed1 = parseIdentifier(a.identifier);
      const parsed2 = parseIdentifier(b.identifier);
      
      // Compare base numbers first
      if (parsed1.base !== null && parsed2.base !== null) {
        if (parsed1.base !== parsed2.base) {
          return parsed1.base - parsed2.base;
        }
        
        // Base numbers equal, compare suffix arrays
        // Shorter suffix array comes first (102 before 102-1)
        const minLen = Math.min(parsed1.suffix.length, parsed2.suffix.length);
        
        for (let i = 0; i < minLen; i++) {
          if (parsed1.suffix[i] !== parsed2.suffix[i]) {
            return parsed1.suffix[i] - parsed2.suffix[i];
          }
        }
        
        // All compared suffixes equal, shorter array wins
        if (parsed1.suffix.length !== parsed2.suffix.length) {
          return parsed1.suffix.length - parsed2.suffix.length;
        }
        
        // Suffixes identical, compare tails
        const tailCompare = parsed1.tail.localeCompare(parsed2.tail);
        if (tailCompare !== 0) return tailCompare;
        
        // Tails identical, compare by type display name
        const typeA = getTypeDisplayName(a.type) || '';
        const typeB = getTypeDisplayName(b.type) || '';
        return typeA.localeCompare(typeB);
      }
      
      // One or both don't have numeric base, fall back to string compare
      if (parsed1.base === null && parsed2.base !== null) return 1;
      if (parsed1.base !== null && parsed2.base === null) return -1;
      
      // Neither has numeric base
      const identifierCompare = a.identifier.localeCompare(b.identifier);
      if (identifierCompare !== 0) return identifierCompare;
      
      // If identifiers are equal, compare by type display name
      const typeA = getTypeDisplayName(a.type) || '';
      const typeB = getTypeDisplayName(b.type) || '';
      return typeA.localeCompare(typeB);
    });
    
    return filtered;
  }, [allKeySets, typeFilter, effectiveLocationFilter, statusFilter, searchTerm, locations, getTypeDisplayName]);

  const handleEdit = useCallback((set: any) => {
    setEditingSet(set);
    setShowForm(true);
  }, []);

  const handleIssue = useCallback((set: any) => {
    setSelectedSet(set);
    setShowIssueForm(true);
  }, []);

  const handleMove = useCallback((set: any) => {
    setSelectedSet(set);
    setShowMoveForm(true);
  }, []);

  const handleDetails = useCallback((set: any) => {
    setSelectedSet(set);
    setShowDetailsForm(true);
  }, []);

  const resetForms = () => {
    setEditingSet(null);
    setSelectedSet(null);
    setShowForm(false);
    setShowDetailsForm(false);
    setShowMoveForm(false);
    setShowIssueForm(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  // ─── Lone Working gate: no access without an active check-in ──────────────
  if (lwBlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm w-full border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                <Lock className="w-7 h-7 text-amber-600 dark:text-amber-300" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Keys locked</h2>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                You must sign on to a lone working shift before you can view keys.
              </p>
            </div>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => navigate("/lone-working/check-in")}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Go to Sign On
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Sticky Header Wrapper - Desktop only */}
      <div className="lg:sticky lg:top-[-1.5rem] lg:z-40 lg:bg-gray-50 lg:pt-0 lg:pb-0 lg:mx-[-1.5rem] lg:px-[1.5rem]">
        <Card className="lg:rounded-b-none lg:border-b-0 bg-white">
          <CardHeader className="bg-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
              <div>
                <CardTitle>Key Management</CardTitle>
              {statusFilter === "missing" && (
                <p className="text-sm text-red-600 mt-1">
                  Showing missing keys from audit results
                </p>
              )}
              {statusFilter === "issued" && (
                <p className="text-sm text-green-600 mt-1">
                  Showing currently issued keys
                </p>
              )}
              {statusFilter !== "all" && statusFilter !== "missing" && statusFilter !== "issued" && (
                <p className="text-sm text-blue-600 mt-1">
                  Filtered by status: {getStatusDisplayName(statusFilter)}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3" data-tour="key-filters">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Bunches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bunches</SelectItem>
                  {settings?.keyTypes?.filter((type: any) => type.isActive).map((type: any) => (
                    <SelectItem key={type.id} value={type.id}>{type.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Static LW workers see a locked location badge instead of a dropdown */}
              {lwEnabled && !isAdmin && activeCheckIn && isStaticJob && staticLocationId ? (
                <div className="flex items-center gap-1.5 px-3 h-9 rounded-md border bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
                  <Lock className="w-3 h-3 shrink-0" />
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[140px]">
                    {(locations as any[]).find((l: any) => l.id === staticLocationId)?.name ?? "Your location"}
                  </span>
                </div>
              ) : (
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {(locations as any[]).map((location: any) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name} ({getLocationTypeDisplayName(location.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {settings?.statuses?.filter((status: any) => status.isActive).map((status: any) => (
                    <SelectItem key={status.id} value={status.id}>{status.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {!isAdmin && lwEnabled && hasLwAssignments ? null : (
                <div className="flex gap-2">
                  <Link href="/bulk-upload">
                    <Button variant="outline" data-testid="button-bulk-upload">
                      <Upload className="mr-2" size={16} />
                      Bulk Upload
                    </Button>
                  </Link>
                  <Button onClick={() => setShowForm(true)} data-tour="add-key-button">
                    <Plus className="mr-2" size={16} />
                    Add Set
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Input
              key="search-input"
              placeholder="Search by set ID, tag, location, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              autoComplete="off"
              data-testid="input-search"
            />
            {(!lwEnabled || isAdmin || !hasLwAssignments) && (
              <label className="flex items-center gap-2 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Show Deleted Keys</span>
              </label>
            )}
          </div>
        </CardHeader>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="lg:rounded-t-none lg:border-t-0 lg:mt-0">
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto" data-tour="key-list">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Set ID & Tag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Update
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {showDeleted && deletedKeys.length > 0 && (
                  <>
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-6 py-2 text-sm font-medium text-red-800">
                        Deleted Keys ({deletedKeys.length})
                      </td>
                    </tr>
                    {deletedKeys.map((key: any) => (
                      <tr key={`deleted-${key.id}`} className="bg-red-50 opacity-70 hover:opacity-100">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 line-through">{key.identifier}</div>
                          <div className="text-sm text-gray-500">
                            Deleted: {new Date(key.deletedAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getTypeColor(key.type)}>
                            {getTypeDisplayName(key.type)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {key.location ? key.location.name : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-red-100 text-red-800">DELETED</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimeAgo(key.deletedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = `/key-history/${key.id}`}
                            className="text-blue-600 hover:text-blue-700"
                            title="View Full History"
                          >
                            <History size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-2 text-sm font-medium text-gray-800">
                        Active Keys ({keySets.length})
                      </td>
                    </tr>
                  </>
                )}
                {keySets.map((set: any) => (
                  <tr key={set.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div>
                        <div 
                          className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                          onClick={() => window.location.href = `/key-history/${set.id}`}
                        >
                          {set.identifier}
                        </div>
                        <div className="text-xs text-gray-500">
                          Seal: {set.status === "issued" ? "Seal broken" : (set.currentTag || "No seal")}
                        </div>
                        <div className="text-xs text-blue-600">
                          {set.keyCount ?? 0} key{(set.keyCount ?? 0) !== 1 ? 's' : ''}
                          {(set.fobCount ?? 0) > 0 && `, ${set.fobCount} fob${set.fobCount !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getTypeColor(set.type)}>
                        {getTypeDisplayName(set.type)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>
                        {set.location ? (
                          <Badge 
                            style={{ 
                              backgroundColor: set.location.color || '#3b82f6',
                              color: '#ffffff'
                            }}
                            className="mb-1"
                          >
                            {set.location.name}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No location</span>
                        )}
                        {set.keyDescription && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={set.keyDescription}>
                            {set.keyDescription}
                          </div>
                        )}
                        {set.address && (
                          <div className="text-xs mt-1 max-w-xs truncate">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(set.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                              title={`Open ${set.address} in Google Maps`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📍 {set.address}
                            </a>
                          </div>
                        )}
                        {set.notes && (
                          <div className="text-xs text-blue-600 mt-1 max-w-xs truncate" title={set.notes}>
                            📝 {set.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusColor(set.status)}>
                        {getStatusDisplayName(set.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimeAgo(set.lastUpdated)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDetails(set)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Key Details"
                        >
                          <Key size={16} />
                        </Button>

                        {(() => {
                          const issuedStatus = settings?.statuses?.find((s: any) => s.displayName === "Issued");
                          const missingStatus = settings?.statuses?.find((s: any) => s.displayName === "Missing");
                          const isIssued = issuedStatus?.id === set.status;
                          const isMissing = missingStatus?.id === set.status;
                          
                          if (isMissing) {
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleIssue(set)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Mark as Found"
                              >
                                <RotateCcw size={16} />
                              </Button>
                            );
                          }
                          
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleIssue(set)}
                              className={isIssued ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                              title={isIssued ? "Return Keys" : "Issue Keys"}
                            >
                              {isIssued ? <ArrowLeft size={16} /> : <LogOut size={16} />}
                            </Button>
                          );
                        })()}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMove(set)}
                          className="text-gray-600 hover:text-gray-700"
                          title="Move Keys"
                        >
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-3">
            {/* Deleted Keys Section - Mobile */}
            {showDeleted && deletedKeys.length > 0 && (
              <>
                <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                  <div className="text-sm font-semibold text-red-800">
                    Deleted Keys ({deletedKeys.length})
                  </div>
                </div>
                {deletedKeys.map((key: any) => (
                  <div key={`deleted-${key.id}`} className="border-2 border-red-300 rounded-lg p-4 bg-red-50 opacity-80">
                    <div className="flex flex-col space-y-3">
                      {/* Header with ID */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-lg line-through">
                            {key.identifier}
                          </div>
                          <div className="text-sm text-red-700 mt-1">
                            Deleted: {new Date(key.deletedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.location.href = `/key-history/${key.id}`}
                          className="text-blue-600 hover:text-blue-700 p-2 flex-shrink-0"
                          title="View Full History"
                        >
                          <History size={16} />
                        </Button>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getTypeColor(key.type)}>
                          {getTypeDisplayName(key.type)}
                        </Badge>
                        {key.location && (
                          <Badge 
                            style={{ 
                              backgroundColor: key.location.color || '#3b82f6',
                              color: '#ffffff'
                            }}
                          >
                            {key.location.name}
                          </Badge>
                        )}
                        <Badge className="bg-red-100 text-red-800 border-red-300">
                          DELETED
                        </Badge>
                      </div>

                      {/* Last Updated */}
                      <div className="text-xs text-gray-500 pt-1">
                        {formatTimeAgo(key.deletedAt)}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                  <div className="text-sm font-semibold text-gray-800">
                    Active Keys ({keySets.length})
                  </div>
                </div>
              </>
            )}
            
            {/* Active Keys */}
            {keySets.map((set: any) => (
              <div key={set.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50">
                <div className="flex flex-col space-y-3">
                  {/* Header with ID and Actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div 
                        className="font-semibold text-blue-600 hover:text-blue-800 cursor-pointer text-lg"
                        onClick={() => window.location.href = `/key-history/${set.id}`}
                      >
                        {set.identifier}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Seal: {set.status === "issued" ? "Seal broken" : (set.currentTag || "No seal")}
                        {set.notes && (
                          <span className="ml-2 text-blue-600">📝</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 flex-shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDetails(set)}
                        className="text-blue-600 hover:text-blue-700 p-2"
                        title="Key Details"
                      >
                        <Key size={14} />
                      </Button>

                      {(() => {
                        const issuedStatus = settings?.statuses?.find((s: any) => s.displayName === "Issued");
                        const missingStatus = settings?.statuses?.find((s: any) => s.displayName === "Missing");
                        const isIssued = issuedStatus?.id === set.status;
                        const isMissing = missingStatus?.id === set.status;
                        
                        if (isMissing) {
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleIssue(set)}
                              className="text-blue-600 hover:text-blue-700 p-2"
                              title="Mark as Found"
                            >
                              <RotateCcw size={14} />
                            </Button>
                          );
                        }
                        
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIssue(set)}
                            className={`p-2 ${isIssued ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}`}
                            title={isIssued ? "Return Keys" : "Issue Keys"}
                          >
                            {isIssued ? <ArrowLeft size={14} /> : <LogOut size={14} />}
                          </Button>
                        );
                      })()}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMove(set)}
                        className="text-gray-600 hover:text-gray-700 p-2"
                        title="Move Keys"
                      >
                        <ArrowRight size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getTypeColor(set.type)}>
                      {getTypeDisplayName(set.type)}
                    </Badge>
                    {set.location && (
                      <Badge 
                        style={{ 
                          backgroundColor: set.location.color || '#3b82f6',
                          color: '#ffffff'
                        }}
                      >
                        {set.location.name}
                      </Badge>
                    )}
                    <Badge className={getStatusColor(set.status)}>
                      {getStatusDisplayName(set.status)}
                    </Badge>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 font-medium">Seal</div>
                      <div className="text-gray-900">{set.status === "issued" ? "Seal broken" : (set.currentTag || "No seal")}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 font-medium">Contents</div>
                      <div className="text-gray-900">
                        {set.keyCount ?? 0} key{(set.keyCount ?? 0) !== 1 ? 's' : ''}
                        {(set.fobCount ?? 0) > 0 && `, ${set.fobCount} fob${set.fobCount !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(set.keyDescription || set.address || set.notes) && (
                    <div className="pt-2 border-t border-gray-100">
                      {set.keyDescription && (
                        <div className="text-xs text-gray-500 mb-1">
                          {set.keyDescription}
                        </div>
                      )}
                      {set.address && (
                        <div className="text-xs mb-1">
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(set.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                            title={`Open ${set.address} in Google Maps`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            📍 {set.address}
                          </a>
                        </div>
                      )}
                      {set.notes && (
                        <div className="text-xs text-blue-600">
                          📝 {set.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Last Updated */}
                  <div className="text-xs text-gray-400 pt-1">
                    Updated {formatTimeAgo(set.lastUpdated)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {keySets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No key sets found matching your criteria
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing {keySets.length} result{keySets.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <KeyBunchForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingSet(null);
        }}
        editingBunch={editingSet}
      />

      <KeyIssueForm
        open={showIssueForm}
        onOpenChange={(open) => {
          setShowIssueForm(open);
          if (!open) setSelectedSet(null);
        }}
        keyBunch={selectedSet}
      />

      <MoveKeyForm
        open={showMoveForm}
        onOpenChange={(open) => {
          setShowMoveForm(open);
          if (!open) setSelectedSet(null);
        }}
        keyBunch={selectedSet}
      />

      <KeyDetailsForm
        open={showDetailsForm}
        onOpenChange={(open) => {
          setShowDetailsForm(open);
          if (!open) setSelectedSet(null);
        }}
        keyBunch={selectedSet}
      />

      {/* Scroll to Top/Bottom Buttons (Desktop only) */}
      {showScrollButtons && (
        <div className="hidden lg:flex fixed right-6 bottom-6 flex-col gap-2 z-20">
          <Button
            size="icon"
            variant="outline"
            onClick={scrollToTop}
            className="bg-white shadow-lg hover:bg-gray-50"
            data-testid="button-scroll-top"
            title="Scroll to top"
          >
            <ArrowUp size={20} />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={scrollToBottom}
            className="bg-white shadow-lg hover:bg-gray-50"
            data-testid="button-scroll-bottom"
            title="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </Button>
        </div>
      )}

    </div>
  );
};

export default KeyBunches;
