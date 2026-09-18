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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface UnlockSignedPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poNumber?: string;
  submitting?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function UnlockSignedPoDialog({
  open,
  onOpenChange,
  poNumber,
  submitting = false,
  onConfirm,
}: UnlockSignedPoDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) setReason("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Edit signed purchase order{poNumber ? ` — ${poNumber}` : ""}
          </DialogTitle>
          <DialogDescription>
            This PO has already been signed. Editing it will invalidate the
            current signature and require the Supply Chain Director to sign
            again. Do you want to continue?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">Reason (required)</Label>
          <Textarea
            id="unlock-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this signed PO needs to be changed"
            className="min-h-[90px]"
            disabled={submitting}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm(trimmed)}
            disabled={submitting || trimmed.length < 3}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlocking…
              </>
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
