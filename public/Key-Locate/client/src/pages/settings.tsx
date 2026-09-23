import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Plus, Edit, Trash, Save, Palette, Building, Building2, Truck, Car, Warehouse, Box, Home, Store, Factory, Package, MapPin, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@shared/permissions";

const settingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  displayName: z.string().min(1, "Display name is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
});

type SettingForm = z.infer<typeof settingSchema>;

interface Setting {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  isDefault?: boolean;
}

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

const AVAILABLE_ICONS: Array<{ name: IconName; component: typeof Building }> = [
  { name: "Building", component: Building },
  { name: "Building2", component: Building2 },
  { name: "Truck", component: Truck },
  { name: "Car", component: Car },
  { name: "Warehouse", component: Warehouse },
  { name: "Box", component: Box },
  { name: "Home", component: Home },
  { name: "Store", component: Store },
  { name: "Factory", component: Factory },
  { name: "Package", component: Package },
  { name: "MapPin", component: MapPin },
  { name: "Wrench", component: Wrench },
];

const getIconComponent = (iconName?: string) => {
  if (iconName && iconName in ICON_COMPONENTS) {
    return ICON_COMPONENTS[iconName as IconName];
  }
  return MapPin;
};

const Settings = () => {
  const { can } = usePermissions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("key-types");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);

  // Check permissions
  if (!can(PERMISSIONS.SYSTEM_ADMIN)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600">You don't have permission to access system settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const form = useForm<SettingForm>({
    resolver: zodResolver(settingSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      color: "#3b82f6",
      icon: "MapPin",
      isActive: true,
    },
  });

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  const addSettingMutation = useMutation({
    mutationFn: async (data: { category: string; setting: SettingForm }) => {
      return apiRequest("POST", `/api/settings/${data.category}`, data.setting);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", "all"] });
      setShowAddDialog(false);
      setEditingSetting(null);
      form.reset();
      toast({
        title: "Setting added",
        description: "The setting has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add setting",
        variant: "destructive",
      });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async (data: { category: string; id: string; setting: Partial<SettingForm> }) => {
      console.log("Mutation data being sent:", data);
      return apiRequest("PATCH", `/api/settings/${data.category}/${data.id}`, data.setting);
    },
    onSuccess: (response) => {
      console.log("Update successful, response:", response);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", "all"] });
      
      // Force refresh after a small delay
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["/api/settings"] });
      }, 100);
      
      setEditingSetting(null);
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "Setting updated",
        description: "The setting has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (data: { category: string; id: string }) => {
      return apiRequest("DELETE", `/api/settings/${data.category}/${data.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches", "all"] });
      toast({
        title: "Setting deleted",
        description: "The setting has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete setting",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingForm) => {
    console.log("Form submission:", { data, editingSetting, activeTab });
    if (editingSetting) {
      console.log("Updating setting:", { category: activeTab, id: editingSetting.id, setting: data });
      updateSettingMutation.mutate({
        category: activeTab,
        id: editingSetting.id,
        setting: data,
      });
    } else {
      console.log("Adding setting:", { category: activeTab, setting: data });
      addSettingMutation.mutate({
        category: activeTab,
        setting: data,
      });
    }
  };

  const handleEdit = (setting: Setting) => {
    console.log("Editing setting:", setting);
    setEditingSetting(setting);
    const formData = {
      name: setting.name,
      displayName: setting.displayName,
      description: setting.description || "",
      color: setting.color || "#3B82F6",
      icon: setting.icon || "MapPin",
      isActive: setting.isActive,
    };
    console.log("Form data for edit:", formData);
    form.reset(formData);
    setShowAddDialog(true);
  };

  const handleDelete = (category: string, id: string, item: Setting) => {
    if (confirm("Are you sure you want to delete this setting? This action cannot be undone.")) {
      deleteSettingMutation.mutate({ category, id });
    }
  };

  const renderSettingsList = (category: string, title: string, items: Setting[] = []) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {category !== "statuses" && category !== "actions" && (
          <Button 
            size="sm" 
            onClick={() => {
              setActiveTab(category);
              setEditingSetting(null);
              form.reset();
              setShowAddDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {title.slice(0, -1)}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No {title.toLowerCase()} configured
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const IconComponent = category === "location-types" && item.icon 
                ? getIconComponent(item.icon) 
                : null;
              
              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {IconComponent ? (
                      <IconComponent 
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: item.color }}
                      />
                    ) : item.color && (
                      <div 
                        className="w-4 h-4 rounded-full border flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.displayName}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500 truncate">{item.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                      className="flex-shrink-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {category !== "statuses" && category !== "actions" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(category, item.id, item)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 md:h-6 md:w-6" />
            System Settings
          </h1>
          <p className="text-sm md:text-base text-gray-600">Configure system-wide settings and options</p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
            <TabsTrigger value="key-types" className="text-xs md:text-sm px-2 md:px-4">Key Types</TabsTrigger>
            <TabsTrigger value="statuses" className="text-xs md:text-sm px-2 md:px-4">Statuses</TabsTrigger>
            <TabsTrigger value="location-types" className="text-xs md:text-sm px-2 md:px-4">Location Types</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs md:text-sm px-2 md:px-4">Action Types</TabsTrigger>
          </TabsList>

          <div className="mt-4 md:mt-6">
            <TabsContent value="key-types">
              {renderSettingsList("key-types", "Key Types", settings.keyTypes)}
            </TabsContent>

            <TabsContent value="statuses">
              {renderSettingsList("statuses", "Statuses", settings.statuses)}
            </TabsContent>

            <TabsContent value="location-types">
              {renderSettingsList("location-types", "Location Types", settings.locationTypes)}
            </TabsContent>

            <TabsContent value="actions">
              {renderSettingsList("actions", "Action Types", settings.actions)}
            </TabsContent>
          </div>
        </Tabs>

        {/* Add/Edit Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSetting ? "Edit Setting" : "Add New Setting"}
              </DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., master_key" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Master Key" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Brief description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="color" 
                            value={field.value || "#3B82F6"}
                            onChange={(e) => {
                              console.log("Color changed to:", e.target.value);
                              field.onChange(e.target.value);
                            }}
                            className="w-20 h-10"
                          />
                          <span className="text-sm text-gray-600">{field.value || "#3B82F6"}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {activeTab === "location-types" && (
                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue>
                                {field.value && (
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const IconComponent = getIconComponent(field.value);
                                      return <IconComponent className="h-4 w-4" />;
                                    })()}
                                    <span>{field.value}</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_ICONS.map((icon) => (
                                <SelectItem key={icon.name} value={icon.name}>
                                  <div className="flex items-center gap-2">
                                    <icon.component className="h-4 w-4" />
                                    <span>{icon.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addSettingMutation.isPending || updateSettingMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingSetting ? "Update" : "Add"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Settings;