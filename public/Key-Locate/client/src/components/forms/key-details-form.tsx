import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getBunchTypeName } from "@/lib/utils";
import { Nfc, Unlink, Smartphone, Wifi, AlertTriangle, Archive } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const keyDetailsSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  keyCount: z.number().min(0, "Key count cannot be negative"),
  fobCount: z.number().min(0, "Fob count cannot be negative"),
  keyDescription: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  currentTag: z.string().optional(),
});

type KeyDetailsData = z.infer<typeof keyDetailsSchema>;

interface KeyDetailsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyBunch: any;
}

const KeyDetailsForm = ({ open, onOpenChange, keyBunch }: KeyDetailsFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getTypeDisplayName } = useSettingsHelpers();
  
  // NFC functionality state
  const [nfcSerial, setNfcSerial] = useState("");
  const [currentNfcSerial, setCurrentNfcSerial] = useState<string | null>(null);
  const [isNFCSupported, setIsNFCSupported] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [nfcController, setNfcController] = useState<AbortController | null>(null);
  
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const form = useForm<KeyDetailsData>({
    resolver: zodResolver(keyDetailsSchema),
    defaultValues: {
      identifier: keyBunch?.identifier || "",
      keyCount: keyBunch?.keyCount ?? 0,
      fobCount: keyBunch?.fobCount ?? 0,
      keyDescription: keyBunch?.keyDescription || "",
      address: keyBunch?.address || "",
      notes: keyBunch?.notes || "",
      currentTag: keyBunch?.currentTag || "",
    },
  });

  // Check NFC support
  useEffect(() => {
    const checkNFCSupport = async () => {
      if ('NDEFReader' in window) {
        try {
          const ndefReader = new (window as any).NDEFReader();
          setIsNFCSupported(true);
        } catch (error) {
          setIsNFCSupported(false);
        }
      } else {
        setIsNFCSupported(false);
      }
    };
    checkNFCSupport();
  }, []);

  // Abort any active NFC reader when the dialog closes
  React.useEffect(() => {
    if (!open && nfcController) {
      nfcController.abort();
      setNfcController(null);
      setIsScanning(false);
    }
  }, [open]);

  // Update form when keyBunch changes
  React.useEffect(() => {
    if (keyBunch) {
      form.reset({
        identifier: keyBunch.identifier || "",
        keyCount: keyBunch.keyCount ?? 0,
        fobCount: keyBunch.fobCount ?? 0,
        keyDescription: keyBunch.keyDescription || "",
        address: keyBunch.address || "",
        notes: keyBunch.notes || "",
        currentTag: keyBunch.currentTag || "",
      });
      setNfcSerial(keyBunch.nfcSerial || "");
      setCurrentNfcSerial(keyBunch.nfcSerial || null);
    }
  }, [keyBunch, form]);

  // NFC Scanning functionality
  const startNFCScanning = async () => {
    if (!isNFCSupported) {
      toast({
        title: "NFC Not Supported",
        description: "Your device doesn't support Web NFC API. Please use Chrome on Android.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsScanning(true);
      const controller = new AbortController();
      setNfcController(controller);

      const ndefReader = new (window as any).NDEFReader();
      
      console.log('Starting NFC scan for key linking...');
      
      await ndefReader.scan({ signal: controller.signal });
      
      toast({
        title: "NFC Scanner Active",
        description: "Hold your device near an NFC tag to automatically link it.",
        duration: 8000,
      });

      ndefReader.addEventListener("reading", ({ message, serialNumber }: any) => {
        console.log('NFC tag detected for linking!', { serialNumber, message });
        
        let nfcId;
        if (serialNumber) {
          if (serialNumber instanceof ArrayBuffer) {
            nfcId = Array.from(new Uint8Array(serialNumber))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          } else {
            nfcId = serialNumber;
          }
        } else {
          nfcId = `nfc_${Date.now()}`;
        }
        
        console.log('Processing NFC ID for linking:', nfcId);
        setNfcSerial(nfcId);
        stopNFCScanning();
        
        // Automatically link the NFC tag
        linkNFCMutation.mutate(nfcId);
      });

      ndefReader.addEventListener("readingerror", (event: any) => {
        console.error('NFC reading error:', event);
        toast({
          title: "NFC Read Error",
          description: "Failed to read NFC tag. Try again.",
          variant: "destructive",
        });
      });

    } catch (error: any) {
      console.error('NFC scan error:', error);
      setIsScanning(false);
      
      let errorMessage = "Failed to start NFC scanning";
      if (error.name === 'NotAllowedError') {
        errorMessage = "NFC access denied. Please allow NFC permissions.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "NFC is not supported on this device.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "NFC is not available. Please enable NFC in settings.";
      }
      
      toast({
        title: "NFC Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopNFCScanning = () => {
    if (nfcController) {
      nfcController.abort();
      setNfcController(null);
    }
    setIsScanning(false);
  };

  // NFC Link/Unlink mutations
  const linkNFCMutation = useMutation({
    mutationFn: async (nfcSerial: string) => {
      if (!keyBunch?.id) throw new Error("No key selected");
      return apiRequest("POST", `/api/key-bunches/${keyBunch.id}/link-nfc`, {
        nfcSerial
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "NFC Tag Linked",
        description: `NFC tag has been linked to ${keyBunch.identifier}`,
      });
      
      // Update local state immediately
      setCurrentNfcSerial(variables);
      
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches/all"] });
    },
    onError: (error: any) => {
      // Silently ignore guard errors (e.g. stale NFC reader firing after dialog closed)
      if (error.message === "No key selected") return;
      console.error('NFC Link Error:', error);
      let errorTitle = "Failed to Link NFC Tag";
      let errorMessage = "An error occurred while linking the NFC tag";
      
      if (error.message) {
        if (error.message.includes("already linked to key bunch")) {
          // Extract the key bunch identifier from the error message
          const match = error.message.match(/already linked to key bunch (\S+)/);
          const keyBunchId = match ? match[1] : "another key bunch";
          errorTitle = "Cannot Use Same NFC Tag";
          errorMessage = `This NFC tag is already assigned to keys ${keyBunchId}`;
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      setNfcSerial("");
    },
  });

  const unlinkNFCMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/key-bunches/${keyBunch.id}/unlink-nfc`);
    },
    onSuccess: () => {
      toast({
        title: "NFC Tag Unlinked",
        description: `NFC tag has been unlinked from ${keyBunch.identifier}`,
      });
      setNfcSerial("");
      
      // Update local state immediately
      setCurrentNfcSerial(null);
      
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches/all"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Unlink NFC Tag",
        description: error.message || "An error occurred while unlinking the NFC tag",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: KeyDetailsData) => 
      apiRequest("PATCH", `/api/key-bunches/${keyBunch.id}`, {
        identifier: data.identifier,
        keyCount: data.keyCount,
        fobCount: data.fobCount,
        keyDescription: data.keyDescription,
        address: data.address,
        notes: data.notes,
        currentTag: data.currentTag,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Key details updated successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to update key details";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reason?: string) => apiRequest("DELETE", `/api/key-bunches/${keyBunch.id}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches/deleted/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Key bunch deleted successfully" });
      onOpenChange(false);
      setShowDeleteDialog(false);
      setDeleteReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete key bunch", variant: "destructive" });
    },
  });

  const onSubmit = (data: KeyDetailsData) => {
    updateMutation.mutate(data);
  };

  const handleDelete = () => {
    deleteMutation.mutate(deleteReason);
  };

  if (!keyBunch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Key Details for {keyBunch.identifier}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pb-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Current Location</p>
            <p className="font-medium">{keyBunch.location?.name || "No location"}</p>
            <p className="text-xs text-gray-500">{getTypeDisplayName(keyBunch.type)}</p>
          </div>

          <div>
            <Label htmlFor="identifier" className="text-sm font-medium">Key Set Identifier</Label>
            <Input
              id="identifier"
              {...form.register("identifier")}
              placeholder="e.g., A24-001"
              className="mt-1 h-10 font-mono"
              autoFocus={false}
            />
            {form.formState.errors.identifier && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.identifier.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="currentTag" className="text-sm font-medium">Seal Reference</Label>
            <Input
              id="currentTag"
              {...form.register("currentTag")}
              placeholder="e.g., Blue-23, Red-45"
              className="mt-1 h-10"
              autoFocus={false}
            />
            <p className="text-xs text-gray-500 mt-1">Seal identifier for visual reference</p>
          </div>

          <div>
            <Label htmlFor="keyCount" className="text-sm font-medium">Number of Keys</Label>
            <Input
              id="keyCount"
              type="number"
              min="0"
              {...form.register("keyCount", { valueAsNumber: true })}
              placeholder="Number of keys in this bunch"
              className="mt-1 h-10"
              inputMode="numeric"
              autoFocus={false}
            />
            {form.formState.errors.keyCount && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.keyCount.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="fobCount" className="text-sm font-medium">Number of Fobs</Label>
            <Input
              id="fobCount"
              type="number"
              min="0"
              {...form.register("fobCount", { valueAsNumber: true })}
              placeholder="Number of fobs in this bunch"
              className="mt-1 h-10"
              inputMode="numeric"
              autoFocus={false}
            />
            {form.formState.errors.fobCount && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.fobCount.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="keyDescription" className="text-sm font-medium">Key Description</Label>
            <Textarea
              id="keyDescription"
              {...form.register("keyDescription")}
              placeholder="Describe what these keys unlock (e.g., Building A - Office doors, Storage units)"
              rows={2}
              className="mt-1 min-h-[60px] resize-none"
            />
          </div>

          <div>
            <Label htmlFor="address" className="text-sm font-medium">Address</Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder="e.g., BME 24, Red 43"
              className="mt-1 h-10"
              data-testid="input-address-details"
              autoFocus={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              Physical address identifier for visual reference
            </p>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Add notes about this key bunch, special instructions, etc."
              rows={2}
              className="mt-1 min-h-[60px] resize-none"
            />
          </div>

          <Separator className="my-3" />

          {/* NFC Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Nfc className="h-4 w-4" />
              <Label className="text-sm font-medium">NFC Tag Management</Label>
            </div>

            {isNFCSupported === false && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  NFC is not supported on this device. You need Chrome on Android with NFC enabled.
                </AlertDescription>
              </Alert>
            )}

            {currentNfcSerial ? (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">NFC Tag Linked</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => unlinkNFCMutation.mutate()}
                    disabled={unlinkNFCMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                  >
                    {unlinkNFCMutation.isPending ? (
                      <>
                        <div className="h-3 w-3 mr-1 animate-spin rounded-full border border-red-600 border-t-transparent" />
                        Unlinking...
                      </>
                    ) : (
                      <>
                        <Unlink className="h-3 w-3 mr-1" />
                        Unlink
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-green-700 font-mono break-all">
                  {currentNfcSerial}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">No NFC tag linked to this key bunch</p>
                  
                  {isNFCSupported && (
                    <div className="space-y-2">
                      {isScanning ? (
                        <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Wifi className="h-3 w-3 text-blue-600 animate-pulse" />
                            <span className="text-xs font-medium text-blue-800">NFC Scanner Active</span>
                          </div>
                          <p className="text-xs text-blue-700 mb-2">
                            Hold your device near an NFC tag
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={stopNFCScanning}
                            className="text-red-600 h-8 px-2 text-xs"
                          >
                            Stop Scanning
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={startNFCScanning}
                          disabled={linkNFCMutation.isPending}
                          className="w-full h-10 text-sm"
                        >
                          {linkNFCMutation.isPending ? (
                            <>
                              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Linking...
                            </>
                          ) : (
                            <>
                              <Smartphone className="h-4 w-4 mr-2" />
                              Link NFC Tag
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="mt-2">
                    <Label htmlFor="nfcSerial" className="text-xs text-gray-500">
                      Or enter NFC serial manually:
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="nfcSerial"
                        value={nfcSerial}
                        onChange={(e) => setNfcSerial(e.target.value)}
                        placeholder="Enter NFC tag serial..."
                        className="text-xs font-mono h-9"
                        disabled={linkNFCMutation.isPending}
                        inputMode="none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => linkNFCMutation.mutate(nfcSerial)}
                        disabled={!nfcSerial.trim() || linkNFCMutation.isPending}
                        className="h-9 px-3 text-xs"
                      >
                        {linkNFCMutation.isPending ? (
                          <>
                            <div className="h-3 w-3 mr-1 animate-spin rounded-full border border-white border-t-transparent" />
                            Linking...
                          </>
                        ) : (
                          "Link"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200 sticky bottom-0 bg-white">
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  className="h-10 px-3 text-sm"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Key Bunch</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete key bunch "{keyBunch.identifier}". 
                    A record of this deletion will be preserved in the History section for audit purposes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <Label htmlFor="delete-reason" className="text-sm font-medium">
                    Reason for deletion (optional)
                  </Label>
                  <Textarea
                    id="delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="e.g., Keys no longer needed, location closed, replaced by new set..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete Key Bunch"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <div className="flex space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-10 px-4"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="h-10 px-4"
              >
                {updateMutation.isPending ? "Updating..." : "Update Details"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyDetailsForm;