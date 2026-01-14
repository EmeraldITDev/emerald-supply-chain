import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { grnApi } from "@/services/api";
import { type MRF } from "@/types";

interface GRNRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrf: MRF;
  onSuccess?: () => void;
}

export default function GRNRequestDialog({
  open,
  onOpenChange,
  mrf,
  onSuccess,
}: GRNRequestDialogProps) {
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestGRN = async () => {
    setIsRequesting(true);
    try {
      const response = await grnApi.requestGRN(mrf.id);
      
      if (response.success) {
        toast({
          title: "GRN Requested Successfully",
          description: `GRN has been requested for PO ${mrf.po_number || mrf.po_number}. Procurement will be notified to complete it.`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to request GRN",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while requesting GRN.",
        variant: "destructive",
      });
      console.error("GRN request error:", error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Goods Received Note (GRN)</DialogTitle>
          <DialogDescription>
            Request a GRN for PO {mrf.po_number || mrf.po_number} (MRF {mrf.id}).
            This will notify the Procurement Manager to complete the GRN.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Make sure payment has been processed and goods have been delivered before requesting GRN.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRequesting}
          >
            Cancel
          </Button>
          <Button onClick={handleRequestGRN} disabled={isRequesting}>
            {isRequesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              "Request GRN"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
