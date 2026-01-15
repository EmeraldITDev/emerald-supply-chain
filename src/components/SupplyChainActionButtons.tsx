import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, XCircle } from "lucide-react";
import { mrfApi } from "@/services/api";
import type { MRF, AvailableActions } from "@/types";

interface SupplyChainActionButtonsProps {
  mrf: MRF;
  onUploadSignedPO: (mrfId: string) => void;
  onRejectPO: () => void;
  signedPOFile: File | null;
  onFileChange: (file: File | null) => void;
  isLoading?: boolean;
}

export const SupplyChainActionButtons: React.FC<SupplyChainActionButtonsProps> = ({
  mrf,
  onUploadSignedPO,
  onRejectPO,
  signedPOFile,
  onFileChange,
  isLoading = false,
}) => {
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Don't show anything if loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no actions available, don't render anything
  if (!availableActions) {
    return null;
  }

  // Check if we can upload signed PO (implied by being able to view invoices or having the PO)
  // Supply Chain Director should be able to sign PO when stage is supply_chain
  const canUploadSignedPO = mrf.unsigned_po_url || mrf.unsignedPOUrl;
  
  // Check if we can reject PO (typically when we can upload, we can also reject)
  const canRejectPO = canUploadSignedPO;

  // Only show section if we have at least one action available
  if (!canUploadSignedPO && !canRejectPO) {
    return null;
  }

  return (
    <div className="space-y-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      {/* Upload Signed PO Section */}
      {canUploadSignedPO && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Upload className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Upload Signed PO</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            After reviewing and signing the PO downloaded above, upload the signed version here.
          </p>
          <Input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            disabled={isLoading}
          />
          {signedPOFile && (
            <p className="text-xs text-muted-foreground">
              Selected: {signedPOFile.name}
            </p>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {canUploadSignedPO && (
          <Button
            onClick={() => onUploadSignedPO(mrf.id)}
            className="flex-1"
            disabled={!signedPOFile || isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload & Forward to Finance
          </Button>
        )}
        {canRejectPO && (
          <Button
            variant="destructive"
            onClick={onRejectPO}
            disabled={isLoading}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject PO
          </Button>
        )}
      </div>
    </div>
  );
};
