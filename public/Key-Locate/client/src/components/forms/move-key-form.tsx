import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSettingsHelpers } from "@/hooks/useSettingsHelpers";

const moveKeySchema = z.object({
  toLocationId: z.number().optional(),
  toBunchType: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => data.toLocationId || data.toBunchType, {
  message: "Must specify either a new location or bunch type",
});

type MoveKeyData = z.infer<typeof moveKeySchema>;

interface MoveKeyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyBunch: any;
}

const MoveKeyForm = ({ open, onOpenChange, keyBunch }: MoveKeyFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings, getTypeDisplayName } = useSettingsHelpers();

  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
  });

  const form = useForm<MoveKeyData>({
    resolver: zodResolver(moveKeySchema),
    defaultValues: {
      notes: "",
    },
  });

  const moveMutation = useMutation({
    mutationFn: (data: MoveKeyData) => 
      apiRequest("POST", `/api/key-bunches/${keyBunch.id}/move`, {
        ...data,
        performedBy: 1, // This would come from auth context
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement-history"] });
      toast({ title: "Success", description: "Key bunch moved successfully" });
      onOpenChange(false);
      form.reset({ notes: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move key bunch", variant: "destructive" });
    },
  });

  const onSubmit = (data: MoveKeyData) => {
    moveMutation.mutate(data);
  };

  if (!keyBunch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move {keyBunch.identifier}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Current Status</p>
            <p className="font-medium">{getTypeDisplayName(keyBunch.type)} at {keyBunch.location?.name}</p>
          </div>

          <div>
            <Label htmlFor="toLocationId">Move to Location (Optional)</Label>
            <Select 
              value={form.watch("toLocationId")?.toString() || ""} 
              onValueChange={(value) => form.setValue("toLocationId", value === "no-change" ? undefined : parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select new location (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-change">No change</SelectItem>
                {locations
                  .filter((loc: any) => loc.id !== keyBunch.locationId)
                  .map((location: any) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="toBunchType">Change Bunch Type (Optional)</Label>
            <Select 
              value={form.watch("toBunchType") || ""} 
              onValueChange={(value) => form.setValue("toBunchType", value === "no-change" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select new bunch type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-change">No change</SelectItem>
                {settings?.keyTypes?.filter((type: any) => type.isActive && type.id !== keyBunch.type)
                  .map((type: any) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Reason for move, additional context, etc."
              rows={3}
            />
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={moveMutation.isPending}
            >
              Move Key Bunch
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MoveKeyForm;
