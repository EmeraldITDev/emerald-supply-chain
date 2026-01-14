import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { grnApi } from "@/services/api";
import { type MRF } from "@/types";

interface GRNCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrf: MRF;
  onSuccess?: () => void;
}

export default function GRNCompletionDialog({
  open,
  onOpenChange,
  mrf,
  onSuccess,
}: GRNCompletionDialogProps) {
  const { toast } = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const [grnFile, setGrnFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF, DOC, or DOCX file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setGrnFile(file);
    }
  };

  const handleCompleteGRN = async () => {
    if (!grnFile) {
      toast({
        title: "File Required",
        description: "Please select a GRN file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    try {
      const response = await grnApi.completeGRN(mrf.id, grnFile);
      
      if (response.success) {
        toast({
          title: "GRN Completed Successfully",
          description: `GRN for PO ${mrf.po_number || mrf.po_number} has been completed and uploaded.`,
        });
        setGrnFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to complete GRN",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while completing GRN.",
        variant: "destructive",
      });
      console.error("GRN completion error:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Goods Received Note (GRN)</DialogTitle>
          <DialogDescription>
            Upload the completed GRN document for PO {mrf.po_number || mrf.po_number} (MRF {mrf.id}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload the GRN document confirming that goods have been received.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="grn-file">GRN Document *</Label>
            <Input
              id="grn-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={isCompleting}
            />
            {grnFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{grnFile.name} ({(grnFile.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOC, DOCX (Max 10MB)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCompleting}
          >
            Cancel
          </Button>
          <Button onClick={handleCompleteGRN} disabled={isCompleting || !grnFile}>
            {isCompleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete GRN"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
