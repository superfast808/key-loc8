import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Nfc, Unlink } from "lucide-react";
import type { KeyBunch } from "@shared/schema";

interface NFCLinkDialogProps {
  keyBunch: KeyBunch;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NFCLinkDialog({ keyBunch, open, onOpenChange }: NFCLinkDialogProps) {
  const [nfcSerial, setNfcSerial] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: async (nfcSerial: string) => {
      return apiRequest("POST", `/api/key-bunches/${keyBunch.id}/link-nfc`, {
        nfcSerial
      });
    },
    onSuccess: () => {
      toast({
        title: "NFC Tag Linked",
        description: `NFC tag ${nfcSerial} has been linked to ${keyBunch.identifier}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches/all"] });
      queryClient.invalidateQueries({ queryKey: [`/api/key-bunches/${keyBunch.id}`] });
      onOpenChange(false);
      setNfcSerial("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Link NFC Tag",
        description: error.message || "An error occurred while linking the NFC tag",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/key-bunches/${keyBunch.id}/unlink-nfc`);
    },
    onSuccess: () => {
      toast({
        title: "NFC Tag Unlinked",
        description: `NFC tag has been unlinked from ${keyBunch.identifier}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/key-bunches/all"] });
      queryClient.invalidateQueries({ queryKey: [`/api/key-bunches/${keyBunch.id}`] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Unlink NFC Tag",
        description: error.message || "An error occurred while unlinking the NFC tag",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nfcSerial.trim()) {
      linkMutation.mutate(nfcSerial.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Nfc className="h-5 w-5" />
            NFC Tag Management
          </DialogTitle>
          <DialogDescription>
            Link or unlink an NFC tag to this key bunch for quick scanning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Key Bunch</Label>
            <div className="text-sm text-gray-600">
              {keyBunch.identifier} - {keyBunch.currentTag}
            </div>
          </div>

          {keyBunch.nfcSerial ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Current NFC Serial</Label>
                <div className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                  {keyBunch.nfcSerial}
                </div>
              </div>
              <Button
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                <Unlink className="h-4 w-4 mr-2" />
                {unlinkMutation.isPending ? "Unlinking..." : "Unlink NFC Tag"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nfcSerial" className="text-sm font-medium">
                  NFC Serial Number
                </Label>
                <Input
                  id="nfcSerial"
                  value={nfcSerial}
                  onChange={(e) => setNfcSerial(e.target.value)}
                  placeholder="Enter NFC tag serial number"
                  className="font-mono"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  Scan or manually enter the NFC tag serial number
                </div>
              </div>
              <Button
                type="submit"
                disabled={linkMutation.isPending || !nfcSerial.trim()}
                className="w-full"
              >
                <Nfc className="h-4 w-4 mr-2" />
                {linkMutation.isPending ? "Linking..." : "Link NFC Tag"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}