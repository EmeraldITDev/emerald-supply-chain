import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PORejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrfTitle: string;
  poNumber: string;
  onReject: (reason: string, comments: string) => void;
}

export function PORejectionDialog({ 
  open, 
  onOpenChange, 
  mrfTitle, 
  poNumber,
  onReject 
}: PORejectionDialogProps) {
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      return;
    }

    onReject(reason, comments);
    
    // Reset form
    setReason("");
    setComments("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-destructive">Reject Purchase Order</DialogTitle>
          <DialogDescription>
            Provide detailed feedback for: {mrfTitle} ({poNumber})
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-destructive">
              Rejection Reason *
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this PO is being rejected (required)"
              required
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what needs to be corrected
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">
              Additional Comments (Optional)
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Any additional guidance or notes for the Procurement Manager"
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim()}
            >
              Reject & Send Back
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
