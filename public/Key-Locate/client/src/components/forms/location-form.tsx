import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { insertLocationSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Building, Building2, Truck, Car, Warehouse, Box, Home, Store, Factory, Package, MapPin, Wrench } from "lucide-react";

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

const locationFormSchema = insertLocationSchema.omit({ companyId: true }).extend({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
});

type LocationFormData = z.infer<typeof locationFormSchema>;

interface LocationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLocation?: any;
}

const LocationForm = ({ open, onOpenChange, editingLocation }: LocationFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current company
  const { data: company } = useQuery({
    queryKey: ["/api/companies/current"],
    retry: false,
  });

  // Load dynamic settings
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    retry: false,
  });

  const locationTypes = (settings as any)?.locationTypes || [];
  const statuses = (settings as any)?.statuses || [];

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: editingLocation?.name || "",
      type: editingLocation?.type || locationTypes[0]?.id || "",
      description: editingLocation?.description || "",
      color: editingLocation?.color || "#3b82f6",
    },
  });

  // Update form when editingLocation changes
  React.useEffect(() => {
    if (editingLocation) {
      form.reset({
        name: editingLocation.name || "",
        type: editingLocation.type || "",
        description: editingLocation.description || "",
        color: editingLocation.color || "#3b82f6",
      });
    } else {
      form.reset({
        name: "",
        type: "",
        description: "",
        color: "#3b82f6",
      });
    }
  }, [editingLocation, form]);

  const createMutation = useMutation({
    mutationFn: (data: LocationFormData) => apiRequest("POST", "/api/locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Location created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create location", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LocationFormData>) => 
      apiRequest("PATCH", `/api/locations/${editingLocation?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Location updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update location", variant: "destructive" });
    },
  });

  const onSubmit = (data: LocationFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Add companyId from the current company
    const submissionData = {
      ...data,
      companyId: (company as any)?.id,
    };
    
    if (editingLocation) {
      updateMutation.mutate(submissionData);
    } else {
      createMutation.mutate(submissionData);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit triggered");
    console.log("Current form values:", form.getValues());
    console.log("Form errors:", form.formState.errors);
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingLocation ? "Edit Location" : "Add New Location"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Location Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., Vehicle 6, Office East"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="type">Location Type</Label>
            <Select 
              value={form.watch("type")} 
              onValueChange={(value) => form.setValue("type", value, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locationTypes.map((type: any) => {
                  const IconComponent = getIconComponent(type.icon);
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <IconComponent 
                          className="w-4 h-4"
                          style={{ color: type.color }}
                        />
                        {type.displayName || type.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p className="text-sm text-red-600">{form.formState.errors.type.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Additional details about this location"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="color">Badge Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                type="color"
                {...form.register("color")}
                className="w-20 h-10 cursor-pointer"
              />
              <span className="text-sm text-gray-600">{form.watch("color") || "#3b82f6"}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This color will be used for the location badge on the key management page
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingLocation ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LocationForm;
