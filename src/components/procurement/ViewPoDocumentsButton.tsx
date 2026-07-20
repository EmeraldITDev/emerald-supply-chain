import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import ProcurementDocumentsPanel from "./ProcurementDocumentsPanel";

interface ViewPoDocumentsButtonProps {
  mrfId: string | number;
  poNumber?: string;
  label?: string;
  readOnly?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}

/**
 * Compact button that opens a dialog displaying the full procurement documents
 * registry for an MRF/PO (PO PDFs, signed PO, GRN, waybill, JCC, PFI, etc.).
 * Uses `ProcurementDocumentsPanel` under the hood so users get a live-refreshed
 * list with open/download and (when write-enabled) upload/delete.
 */
export function ViewPoDocumentsButton({
  mrfId,
  poNumber,
  label = "View PO Documents",
  readOnly = true,
  size = "sm",
  variant = "outline",
  className,
}: ViewPoDocumentsButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileText className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              PO Documents{poNumber ? ` · ${poNumber}` : ""}
            </DialogTitle>
            <DialogDescription>
              View and download every document attached to this Purchase Order —
              signed / unsigned POs, GRNs, waybills, JCC, PFI and supporting
              files.
            </DialogDescription>
          </DialogHeader>
          <ProcurementDocumentsPanel
            mrfId={String(mrfId)}
            readOnly={readOnly}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ViewPoDocumentsButton;