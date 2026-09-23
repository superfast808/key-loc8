import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getBunchTypeName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";
import { useAuth } from "@/hooks/useAuth";

const keyIssueSchema = z.object({
  officerName: z.string().min(1, "Officer name is required"),
  purpose: z.string(),
  newTag: z.string().optional(),
  notes: z.string().optional(),
  isReturning: z.boolean().optional(),
}).refine((data) => {
  // Purpose is only required when issuing (not returning)
  if (!data.isReturning && (!data.purpose || data.purpose.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Purpose is required when issuing keys",
  path: ["purpose"],
});

type KeyIssueData = z.infer<typeof keyIssueSchema>;

interface KeyIssueFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyBunch: any;
}

const KeyIssueForm = ({ open, onOpenChange, keyBunch }: KeyIssueFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getTypeDisplayName, getStatusDisplayName, settings } = useSettingsHelpers();
  const [isReturning, setIsReturning] = useState(false);
  const { user } = useAuth();

  const form = useForm<KeyIssueData>({
    resolver: zodResolver(keyIssueSchema),
    defaultValues: {
      officerName: "",
      purpose: "",
      newTag: "",
      notes: "",
      isReturning: false,
    },
  });

  // Reset form when dialog opens or mode changes
  React.useEffect(() => {
    if (open && keyBunch) {
      // Check if the key is issued or missing - both cases should be treated as "returning"
      const issuedStatus = settings?.statuses?.find((s: any) => 
        s.displayName === "Issued" || s.name === "Issued" || s.id === "issued"
      );
      const missingStatus = settings?.statuses?.find((s: any) => 
        s.displayName === "Missing" || s.name === "Missing" || s.id === "missing"
      );
      const returning = (issuedStatus && keyBunch.status === issuedStatus.id) || 
                       (missingStatus && keyBunch.status === missingStatus.id);
      setIsReturning(returning);
      
      form.clearErrors();
      form.reset({
        officerName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || "",
        purpose: returning ? (missingStatus && keyBunch.status === missingStatus.id ? "Key found" : "Key return") : "",
        newTag: "",
        notes: "",
        isReturning: returning,
      });
      
      // Explicitly set isReturning value for validation
      form.setValue("isReturning", returning);
    }
  }, [open, keyBunch, form, settings, user]);

  const issueMutation = useMutation({
    mutationFn: (data: KeyIssueData) => {
      // Issue keys - change status to in_use and replace tag
      return apiRequest("POST", `/api/key-bunches/${keyBunch.id}/issue`, {
        officerName: data.officerName,
        purpose: data.purpose,
        newTag: data.newTag,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Keys issued successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to issue keys", variant: "destructive" });
    },
  });

  const returnMutation = useMutation({
    mutationFn: (data: KeyIssueData) => {
      // Return keys - change status back to active and replace tag
      return apiRequest("POST", `/api/key-bunches/${keyBunch.id}/return`, {
        officerName: data.officerName,
        newTag: data.newTag,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Keys returned successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Return error:", error);
      toast({ 
        title: "Error", 
        description: error?.response?.data?.message || "Failed to return keys", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: KeyIssueData) => {
    console.log("Form submitted:", { data, isReturning, keyBunch });
    
    if (isReturning) {
      console.log("Calling return mutation with:", data);
      returnMutation.mutate(data);
    } else {
      console.log("Calling issue mutation with:", data);
      issueMutation.mutate(data);
    }
  };

  if (!keyBunch) return null;

  // Check if the key is missing to show appropriate title
  const missingStatus = settings?.statuses?.find((s: any) => 
    s.displayName === "Missing" || s.name === "Missing" || s.id === "missing"
  );
  const isMissing = missingStatus && keyBunch.status === missingStatus.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isMissing ? "Mark as Found" : (isReturning ? "Return Keys" : "Issue Keys")} - {keyBunch.identifier}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Controller for isReturning to ensure it's properly registered */}
          <Controller
            name="isReturning"
            control={form.control}
            render={({ field }) => <input type="hidden" {...field} value={field.value ? "true" : "false"} />}
          />
          
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Current Location</p>
              <Badge variant={keyBunch.status === "in_use" ? "destructive" : "default"}>
                {keyBunch.status === "in_use" ? "IN USE" : "AVAILABLE"}
              </Badge>
            </div>
            <p className="font-medium">{keyBunch.location?.name || "No location"}</p>
            <p className="text-xs text-gray-500">{getTypeDisplayName(keyBunch.type)}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-600">
              <span>{keyBunch.keyCount || 1} key{(keyBunch.keyCount || 1) !== 1 ? 's' : ''}</span>
              {keyBunch.fobCount > 0 && <span>{keyBunch.fobCount} fob{keyBunch.fobCount !== 1 ? 's' : ''}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Current seal: {keyBunch.currentTag}</p>
          </div>

          {!isReturning && (
            <>
              <div>
                <Label htmlFor="officerName">Officer Name</Label>
                <Input
                  id="officerName"
                  {...form.register("officerName")}
                  placeholder="Enter officer name"
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  data-testid="input-officer-name"
                />
                {form.formState.errors.officerName && (
                  <p className="text-sm text-red-600">{form.formState.errors.officerName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="purpose">Purpose *</Label>
                <Input
                  id="purpose"
                  {...form.register("purpose")}
                  placeholder="e.g., Security patrol, maintenance check"
                  data-testid="input-purpose"
                />
                {form.formState.errors.purpose && (
                  <p className="text-sm text-red-600">{form.formState.errors.purpose.message}</p>
                )}
              </div>

            </>
          )}

          {isReturning && (
            <div className={isMissing ? "bg-green-50 p-3 rounded-md" : "bg-blue-50 p-3 rounded-md"}>
              <p className={`text-sm font-medium ${isMissing ? "text-green-800" : "text-blue-800"}`}>
                {isMissing ? "Key was marked as missing" : "Keys are awaiting return"}
              </p>
              <p className={`text-xs ${isMissing ? "text-green-600" : "text-blue-600"}`}>
                {isMissing ? "Mark this key as found and returned" : "Complete the return process below"}
              </p>
            </div>
          )}

          {isReturning && (
            <>
              <div>
                <Label htmlFor="officerName">Officer Name</Label>
                <Input
                  id="officerName"
                  {...form.register("officerName")}
                  placeholder="Enter officer name returning keys"
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  data-testid="input-officer-name-return"
                />
                {form.formState.errors.officerName && (
                  <p className="text-sm text-red-600">{form.formState.errors.officerName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="newTag">New Seal Number *</Label>
                <Input
                  id="newTag"
                  {...form.register("newTag", { 
                    required: "New seal number is required when returning keys"
                  })}
                  placeholder="Enter new seal number for returned keys"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Seal number to apply when returning keys
                </p>
                {form.formState.errors.newTag && (
                  <p className="text-sm text-red-600">{form.formState.errors.newTag.message}</p>
                )}
              </div>
            </>
          )}

          {isReturning && (
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                {...form.register("notes")}
                placeholder="Return notes, any issues encountered"
                rows={2}
                data-testid="textarea-return-notes"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={issueMutation.isPending || returnMutation.isPending}
              variant={isReturning ? "default" : "default"}
              onClick={(e) => {
                console.log("Button clicked:", { 
                  isReturning, 
                  disabled: issueMutation.isPending || returnMutation.isPending,
                  formErrors: form.formState.errors,
                  formValues: form.getValues()
                });
                
                // Force form validation
                form.trigger().then((isValid) => {
                  console.log("Form validation result:", isValid);
                  if (!isValid) {
                    console.log("Form validation errors:", form.formState.errors);
                  }
                });
              }}
            >
              {issueMutation.isPending || returnMutation.isPending 
                ? "Processing..." 
                : (isMissing 
                  ? "Mark as Found" 
                  : (isReturning ? "Return Keys" : "Issue Keys"))}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default KeyIssueForm;