import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertKeyBunchSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Scan, Smartphone } from "lucide-react";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";


const keyBunchFormSchema = insertKeyBunchSchema.omit({ companyId: true }).extend({
  identifier: z.string().min(1, "Identifier is required"),
  currentTag: z.string().optional(),
  locationId: z.number().min(1, "Location is required"),
  keyCount: z.number().min(0, "Key count cannot be negative"),
  fobCount: z.number().min(0, "Fob count cannot be negative"),
  nfcSerial: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type KeyBunchFormData = z.infer<typeof keyBunchFormSchema>;

interface KeyBunchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBunch?: any;
}

const KeyBunchForm = ({ open, onOpenChange, editingBunch }: KeyBunchFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const isNFCSupported = 'NDEFReader' in window;
  const { getLocationTypeDisplayName } = useSettingsHelpers();

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  }) as { data: any };

  // Fetch fresh data for the key bunch when editing, so NFC serial is always current
  // (avoids stale list-data overwriting a value that was set via link-nfc or audit)
  const { data: freshBunch } = useQuery({
    queryKey: ["/api/key-bunches", editingBunch?.id],
    enabled: !!editingBunch?.id && open,
    staleTime: 0, // always re-fetch when form opens
  }) as { data: any };

  const form = useForm<KeyBunchFormData>({
    resolver: zodResolver(keyBunchFormSchema),
    defaultValues: {
      identifier: editingBunch?.identifier || "",
      type: editingBunch?.type || (settings?.keyTypes?.[0]?.id || "day_shift"),
      currentTag: editingBunch?.currentTag || "",
      locationId: editingBunch?.locationId || undefined,
      status: editingBunch?.status || (settings?.statuses?.find((s: any) => s.displayName === "Present")?.id || "active"),
      keyCount: editingBunch?.keyCount ?? 0,
      fobCount: editingBunch?.fobCount ?? 0,
      keyDescription: editingBunch?.keyDescription || "",
      address: editingBunch?.address || "",
      notes: editingBunch?.notes || "",
      nfcSerial: editingBunch?.nfcSerial || "",
    },
  });

  // Update form when editingBunch changes or fresh data arrives
  // Use freshBunch (fetched when form opens) to ensure NFC serial is current
  React.useEffect(() => {
    const bunch = freshBunch || editingBunch;
    if (bunch) {
      form.reset({
        identifier: bunch.identifier || "",
        type: bunch.type || (settings?.keyTypes?.[0]?.id || "day_shift"),
        currentTag: bunch.currentTag || "",
        locationId: bunch.locationId || undefined,
        status: bunch.status || (settings?.statuses?.find((s: any) => s.displayName === "Present")?.id || "active"),
        keyCount: bunch.keyCount ?? 0,
        fobCount: bunch.fobCount ?? 0,
        keyDescription: bunch.keyDescription || "",
        address: bunch.address || "",
        notes: bunch.notes || "",
        nfcSerial: bunch.nfcSerial || "",
      });
    } else {
      form.reset({
        identifier: "",
        type: settings?.keyTypes?.[0]?.id || "day_shift",
        currentTag: "",
        locationId: undefined,
        status: settings?.statuses?.find((s: any) => s.displayName === "Present")?.id || "active",
        keyCount: 0,
        fobCount: 0,
        keyDescription: "",
        address: "",
        notes: "",
        nfcSerial: "",
      });
    }
  }, [freshBunch, editingBunch, form, settings]);

  const createMutation = useMutation({
    mutationFn: (data: KeyBunchFormData) => apiRequest("POST", "/api/key-bunches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Key bunch created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      // Handle NFC conflict errors
      if (error?.conflict && error?.existingKeyBunch) {
        const existing = error.existingKeyBunch;
        toast({ 
          title: "NFC Tag Already in Use", 
          description: `This NFC tag is already assigned to "${existing.identifier}" (${existing.currentTag || 'No seal'})`,
          variant: "destructive" 
        });
      } else {
        const errorMessage = error?.message || "Failed to create key bunch";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<KeyBunchFormData>) => 
      apiRequest("PATCH", `/api/key-bunches/${editingBunch.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Key bunch updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      // Handle NFC conflict errors
      if (error?.conflict && error?.existingKeyBunch) {
        const existing = error.existingKeyBunch;
        toast({ 
          title: "NFC Tag Already in Use", 
          description: `This NFC tag is already assigned to "${existing.identifier}" (${existing.currentTag || 'No seal'})`,
          variant: "destructive" 
        });
      } else {
        const errorMessage = error?.message || "Failed to update key bunch";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    },
  });

  const onSubmit = (data: KeyBunchFormData) => {
    if (editingBunch) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const onError = (errors: any) => {
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error.message}`)
      .filter(Boolean);
    
    if (errorMessages.length > 0) {
      toast({
        title: "Please fill in all required fields",
        description: errorMessages[0],
        variant: "destructive",
      });
      
      // Scroll to top of dialog to show errors
      const dialogContent = document.querySelector('[role="dialog"]');
      if (dialogContent) {
        dialogContent.scrollTop = 0;
      }
    }
  };

  // NFC scanning functionality
  const startNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      toast({
        title: "NFC Not Supported",
        description: "NFC is not supported on this device",
        variant: "destructive",
      });
      return;
    }

    setIsNfcScanning(true);
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      
      ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
        if (serialNumber) {
          form.setValue("nfcSerial", serialNumber);
          toast({
            title: "NFC Tag Scanned",
            description: `Serial: ${serialNumber}`,
          });
          setIsNfcScanning(false);
        }
      });

      // Auto-stop scanning after 10 seconds
      setTimeout(() => {
        setIsNfcScanning(false);
      }, 10000);

    } catch (error) {
      console.error("NFC scan error:", error);
      toast({
        title: "NFC Scan Failed",
        description: "Could not start NFC scanning",
        variant: "destructive",
      });
      setIsNfcScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {editingBunch ? "Edit Key Bunch" : "Add New Key Bunch"}
          </DialogTitle>
          <DialogDescription>
            {editingBunch ? "Update the key bunch information below." : "Fill in the details to create a new key bunch."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-4">
          <div>
            <Label htmlFor="identifier">Bunch Identifier</Label>
            <Input
              id="identifier"
              {...form.register("identifier")}
              placeholder="e.g., A24-001"
              autoFocus={false}
            />
            {form.formState.errors.identifier && (
              <p className="text-sm text-red-600">{form.formState.errors.identifier.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="type">Bunch Type</Label>
            <Select 
              value={form.watch("type")} 
              onValueChange={(value) => form.setValue("type", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings?.keyTypes?.filter(type => type.isActive).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="currentTag">Seal Reference (Optional)</Label>
            <Input
              id="currentTag"
              {...form.register("currentTag")}
              placeholder="TAG-1234"
              autoFocus={false}
            />
            {form.formState.errors.currentTag && (
              <p className="text-sm text-red-600">{form.formState.errors.currentTag.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="locationId">Location</Label>
            <Select 
              value={form.watch("locationId")?.toString() || ""} 
              onValueChange={(value) => form.setValue("locationId", parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {(locations as any[]).map((location: any) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name} ({getLocationTypeDisplayName(location.type)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.locationId && (
              <p className="text-sm text-red-600">{form.formState.errors.locationId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="keyCount">Number of Keys</Label>
            <Input
              id="keyCount"
              type="number"
              min="0"
              {...form.register("keyCount", { valueAsNumber: true })}
              placeholder="Number of keys in this bunch"
            />
            {form.formState.errors.keyCount && (
              <p className="text-sm text-red-600">{form.formState.errors.keyCount.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="fobCount">Number of Fobs</Label>
            <Input
              id="fobCount"
              type="number"
              min="0"
              {...form.register("fobCount", { valueAsNumber: true })}
              placeholder="Number of fobs in this bunch"
            />
            {form.formState.errors.fobCount && (
              <p className="text-sm text-red-600">{form.formState.errors.fobCount.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="keyDescription">Key Description (Optional)</Label>
            <Textarea
              id="keyDescription"
              {...form.register("keyDescription")}
              placeholder="Describe what these keys unlock"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="address">Address (Optional)</Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder="e.g., BME 24, Red 43"
              data-testid="input-address"
            />
            <p className="text-xs text-gray-500 mt-1">
              Physical address identifier for visual reference
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="nfcSerial">NFC Tag ID (Optional)</Label>
              {isNFCSupported && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startNfcScan}
                  disabled={isNfcScanning}
                  className="flex items-center gap-2"
                >
                  {isNfcScanning ? (
                    <Smartphone className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Scan className="h-4 w-4" />
                  )}
                  {isNfcScanning ? "Scanning..." : "Scan NFC"}
                </Button>
              )}
            </div>
            <Input
              id="nfcSerial"
              {...form.register("nfcSerial")}
              placeholder="NFC tag identifier for scanning"
              autoFocus={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isNFCSupported
                ? "Tap 'Scan NFC' to read the tag automatically, or enter the ID manually"
                : "Enter NFC tag ID manually (auto-scan requires Chrome on Android)"}
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Additional notes about this key bunch"
              rows={2}
              autoFocus={false}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={form.watch("status")} 
              onValueChange={(value) => form.setValue("status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings?.statuses?.filter(status => status.isActive).map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingBunch ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyBunchForm;
