import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, XCircle, PenLine, X } from "lucide-react";
import { mrfApi } from "@/services/api";
import type { MRF, AvailableActions } from "@/types";

interface SupplyChainActionButtonsProps {
  mrf: MRF;
  /** Builds a signed PDF from the director’s signature and forwards to Finance (same as upload-signed-po). */
  onAttachSignature: (mrfId: string) => void;
  onUploadSignedPO: (mrfId: string) => void;
  onRejectPO: () => void;
  signedPOFile: File | null;
  /** Optional one-off signature image for this PO (otherwise Settings → saved signature is used). */
  attachSignatureFile: File | null;
  onSignedPOFileChange: (file: File | null) => void;
  onAttachSignatureFileChange: (file: File | null) => void;
  isLoading?: boolean;
  hasSavedProfileSignature?: boolean;
}

export const SupplyChainActionButtons: React.FC<SupplyChainActionButtonsProps> = ({
  mrf,
  onAttachSignature,
  onUploadSignedPO,
  onRejectPO,
  signedPOFile,
  attachSignatureFile,
  onSignedPOFileChange,
  onAttachSignatureFileChange,
  isLoading = false,
  hasSavedProfileSignature = false,
}) => {
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [loading, setLoading] = useState(true);
  const attachSigInputRef = useRef<HTMLInputElement | null>(null);
  const signedPoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        setLoading(true);
        const response = await mrfApi.getAvailableActions(mrf.id);
        if (response.success && response.data) {
          setAvailableActions(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch available actions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [mrf.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!availableActions) {
    return null;
  }

  const canUploadSignedPO = mrf.unsigned_po_url || mrf.unsignedPOUrl;
  const canRejectPO = canUploadSignedPO;

  if (!canUploadSignedPO && !canRejectPO) {
    return null;
  }

  const canAttach =
    Boolean(attachSignatureFile) || Boolean(hasSavedProfileSignature);

  return (
    <div className="space-y-4">
      {canUploadSignedPO && (
        <div className="space-y-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <PenLine className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Attach Signature</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Generates a signed Purchase Order in the standard Emerald layout with{" "}
            <span className="font-medium text-foreground">Mrs. Viva Musa</span> and your
            signature, then forwards to Finance. Use a one-off image below, or your file saved
            in Settings → Digital Signature.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={attachSigInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="max-w-[220px] flex-1 min-w-0"
              onChange={(e) => onAttachSignatureFileChange(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
            {attachSignatureFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                disabled={isLoading}
                onClick={() => {
                  onAttachSignatureFileChange(null);
                  if (attachSigInputRef.current) attachSigInputRef.current.value = "";
                }}
                aria-label="Remove selected signature image"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          {attachSignatureFile && (
            <p className="text-xs text-muted-foreground">Selected: {attachSignatureFile.name}</p>
          )}
          {!attachSignatureFile && !hasSavedProfileSignature && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Upload a signature image here or save one in Settings first.
            </p>
          )}
          <Button
            onClick={() => onAttachSignature(mrf.id)}
            className="w-full"
            disabled={isLoading || !canAttach}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="mr-2 h-4 w-4" />
            )}
            Attach Signature
          </Button>
        </div>
      )}

      {canUploadSignedPO && (
        <div className="space-y-3 p-3 bg-muted/40 border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Upload signed PO file</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Optional: upload your own fully signed PDF or Word document instead of using Attach
            Signature above.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={signedPoInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="max-w-[220px] flex-1 min-w-0"
              onChange={(e) => onSignedPOFileChange(e.target.files?.[0] || null)}
              disabled={isLoading}
            />
            {signedPOFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                disabled={isLoading}
                onClick={() => {
                  onSignedPOFileChange(null);
                  if (signedPoInputRef.current) signedPoInputRef.current.value = "";
                }}
                aria-label="Remove selected signed PO file"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          {signedPOFile && (
            <p className="text-xs text-muted-foreground">Selected: {signedPOFile.name}</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {canUploadSignedPO && (
          <Button
            onClick={() => onUploadSignedPO(mrf.id)}
            variant="secondary"
            className="flex-1"
            disabled={!signedPOFile || isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload &amp; Forward to Finance
          </Button>
        )}
        {canRejectPO && (
          <Button variant="destructive" onClick={onRejectPO} disabled={isLoading}>
            <XCircle className="mr-2 h-4 w-4" />
            Reject PO
          </Button>
        )}
      </div>
    </div>
  );
};
