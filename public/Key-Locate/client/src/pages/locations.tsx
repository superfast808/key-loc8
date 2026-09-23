import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Truck, Building, ExternalLink, FileText, Search, Trash2, Building2, Car, Warehouse, Box, Home, Store, Factory, Package, MapPin, Wrench } from "lucide-react";
import LocationForm from "@/components/forms/location-form";
import { formatTimeAgo } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@shared/permissions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ICON_COMPONENTS = {
  Building,
  Building2,
  Truck,
  Car,
  Warehouse,
  Box,
  Home,
  Store,
  Factory,
  Package,
  MapPin,
  Wrench,
} as const;

type IconName = keyof typeof ICON_COMPONENTS;

const getIconComponent = (iconName?: string) => {
  if (iconName && iconName in ICON_COMPONENTS) {
    return ICON_COMPONENTS[iconName as IconName];
  }
  return MapPin;
};

const Locations = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [deletingLocation, setDeletingLocation] = useState<any>(null);
  const { can } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  }) as { data: any[]; isLoading: boolean };

  const { data: keyBunches = [] } = useQuery({
    queryKey: ["/api/key-bunches"],
  }) as { data: any[] };

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const { data: recentMovements = [] } = useQuery({
    queryKey: ["/api/movement-history", { limit: 10 }],
    queryFn: async () => {
      const response = await fetch("/api/movement-history?limit=10", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  // Calculate location stats
  const locationStats = locations.map((location: any) => {
    const locationBunches = keyBunches.filter((bunch: any) => bunch.locationId === location.id);
    
    // Get actual key type IDs from settings
    const keyTypes = (settings as any)?.keyTypes || [];
    const typeCounts: Record<string, number> = {};
    
    keyTypes.forEach((keyType: any) => {
      // Match by ID, displayName, or name to handle legacy data
      typeCounts[keyType.id] = locationBunches.filter((b: any) => 
        b.type === keyType.id || b.type === keyType.displayName || b.type === keyType.name
      ).length;
    });
    
    return {
      ...location,
      totalBunches: locationBunches.length,
      ...typeCounts,
    };
  });

  const recentTransfers = recentMovements
    .filter((movement: any) => movement.action === "location_move")
    .slice(0, 6);

  const handleEdit = (location: any) => {
    setEditingLocation(location);
    setShowForm(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (locationId: number) => apiRequest("DELETE", `/api/locations/${locationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Location deleted successfully" });
      setDeletingLocation(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete location", 
        variant: "destructive" 
      });
      setDeletingLocation(null);
    },
  });

  const handleDelete = (location: any) => {
    setDeletingLocation(location);
  };

  const confirmDelete = () => {
    if (deletingLocation) {
      deleteMutation.mutate(deletingLocation.id);
    }
  };

  if (locationsLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Business Locations</CardTitle>
              <Button onClick={() => setShowForm(true)} data-tour="add-location-button">
                <Plus className="mr-2" size={16} />
                Add Location
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200" data-tour="location-cards">
              {locationStats.map((location: any) => {
                const locationType = (settings as any)?.locationTypes?.find((t: any) => t.id === location.type);
                const IconComponent = getIconComponent(locationType?.icon);
                const iconColor = locationType?.color || "#6b7280";
                
                return (
                  <div key={location.id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ 
                          backgroundColor: `${iconColor}15` 
                        }}>
                          <IconComponent style={{ color: iconColor }} size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
                          <p className="text-sm text-gray-500">{location.description}</p>
                        </div>
                      </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={
                        location.status === "active" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-yellow-100 text-yellow-800"
                      }>
                        {location.status === "active" ? "Active" : "Limited"}
                      </Badge>
                      {can(PERMISSIONS.LOCATION_EDIT) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(location)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(location)}
                            className="text-red-600 hover:text-red-800"
                            disabled={location.totalBunches > 0}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    {((settings as any)?.keyTypes || []).map((keyType: any, index: number) => {
                      const colors = ['text-blue-600', 'text-purple-600', 'text-orange-600', 'text-green-600'];
                      return (
                        <div key={keyType.id}>
                          <p className={`text-2xl font-bold ${colors[index % colors.length]}`}>{location[keyType.id] || 0}</p>
                          <p className="text-xs text-gray-500">{keyType.displayName}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {can(PERMISSIONS.KEY_BULK_MOVE) && (
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = '/bulk-move-keys'}
              >
                <ExternalLink className="mr-3" size={16} />
                Bulk Move Keys
              </Button>
            )}
            {locations.length > 0 && (
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => window.location.href = `/location-report/${locations[0].id}`}
              >
                <FileText className="mr-3" size={16} />
                Location Report
              </Button>
            )}
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => window.location.href = '/audit'}
            >
              <Search className="mr-3" size={16} />
              Audit Location
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransfers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent transfers</p>
            ) : (
              <div className="space-y-3">
                {recentTransfers.map((transfer: any) => (
                  <div key={transfer.id} className="flex items-center space-x-3 text-sm">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="text-blue-600" size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {transfer.keyBunch?.identifier}
                      </p>
                      <p className="text-gray-500 truncate">
                        {transfer.fromLocation?.name} → {transfer.toLocation?.name}
                      </p>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {formatTimeAgo(transfer.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LocationForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingLocation(null);
        }}
        editingLocation={editingLocation}
      />

      <AlertDialog open={!!deletingLocation} onOpenChange={() => setDeletingLocation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingLocation?.name}"? This action cannot be undone.
              {deletingLocation?.totalBunches > 0 && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 font-medium">
                    This location contains {deletingLocation.totalBunches} key bunches. 
                    Please move or remove all key bunches before deleting.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletingLocation?.totalBunches > 0 || deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Locations;
