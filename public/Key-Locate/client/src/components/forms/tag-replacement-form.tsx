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
import { useToast } from "@/hooks/use-toast";
import { generateNewTag } from "@/lib/utils";

const tagReplacementSchema = z.object({
  newTag: z.string().min(1, "New seal is required"),
  notes: z.string().optional(),
});

type TagReplacementData = z.infer<typeof tagReplacementSchema>;

interface TagReplacementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyBunch: any;
}

const TagReplacementForm = ({ open, onOpenChange, keyBunch }: TagReplacementFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TagReplacementData>({
    resolver: zodResolver(tagReplacementSchema),
    defaultValues: {
      newTag: generateNewTag(),
      notes: "",
    },
  });

  const replaceMutation = useMutation({
    mutationFn: (data: TagReplacementData) => 
      apiRequest("POST", `/api/key-bunches/${keyBunch.id}/replace-tag`, {
        ...data,
        performedBy: 1, // This would come from auth context
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement-history"] });
      toast({ title: "Success", description: "Seal replaced successfully" });
      onOpenChange(false);
      form.reset({ newTag: generateNewTag(), notes: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to replace seal", variant: "destructive" });
    },
  });

  const onSubmit = (data: TagReplacementData) => {
    replaceMutation.mutate(data);
  };

  const generateTag = () => {
    form.setValue("newTag", generateNewTag());
  };

  if (!keyBunch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Replace Seal for {keyBunch.identifier}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Current Seal</p>
            <p className="font-medium">{keyBunch.currentTag}</p>
          </div>

          <div>
            <Label htmlFor="newTag">New Seal</Label>
            <div className="flex gap-2">
              <Input
                id="newTag"
                {...form.register("newTag")}
                placeholder="TAG-1234"
              />
              <Button type="button" variant="outline" onClick={generateTag}>
                Generate
              </Button>
            </div>
            {form.formState.errors.newTag && (
              <p className="text-sm text-red-600">{form.formState.errors.newTag.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Reason for replacement, condition notes, etc."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={replaceMutation.isPending}
            >
              Replace Seal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TagReplacementForm;
