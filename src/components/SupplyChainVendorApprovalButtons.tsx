import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { mrfApi } from "@/services/api";
import type { MRF, AvailableActions } from "@/types";

interface SupplyChainVendorApprovalButtonsProps {
  mrf: MRF;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export const SupplyChainVendorApprovalButtons: React.FC<SupplyChainVendorApprovalButtonsProps> = ({
  mrf,
  onApprove,
  onReject,
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
  if (loading || !availableActions) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Only show buttons if can approve invoice (vendor selection approval)
  if (!availableActions.canApproveInvoice) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={onApprove}
        className="flex-1"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        Approve Vendor Selection
      </Button>
      <Button
        variant="destructive"
        onClick={onReject}
        disabled={isLoading}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Reject
      </Button>
    </div>
  );
};
