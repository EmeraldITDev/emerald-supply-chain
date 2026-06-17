import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Download, Upload, Trash2, CheckCircle2, XCircle, Loader2, FileCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { mrfApi } from "@/services/api";
import type { MRF, AvailableActions } from "@/types";
import { toast } from "sonner";
import { getMrfApiId } from "@/utils/displayId";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

interface MRFActionButtonsProps {
  mrf: MRF;
  onGeneratePO?: () => void;
  onDownloadPO?: () => void;
  onUploadGRN?: () => void;
  onGenerateGRN?: () => void;
  onDeletePO?: () => void;
  onDeleteMRF?: () => void;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "destructive";
  className?: string;
  compact?: boolean; // For list views, show fewer details
}

export const MRFActionButtons: React.FC<MRFActionButtonsProps> = ({
  mrf,
  onGeneratePO,
  onDownloadPO,
  onUploadGRN,
  onGenerateGRN,
  onDeletePO,
  onDeleteMRF,
  size = "sm",
  variant = "default",
  className = "",
  compact = false,
}) => {
  const { user } = useAuth();
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [loading, setLoading] = useState(true);
  const mrfPathId = getMrfApiId(mrf) || String(mrf.id ?? "");

  useEffect(() => {
    const fetchActions = async () => {
      try {
        setLoading(true);
        const response = await mrfApi.getAvailableActions(mrfPathId);
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
  }, [mrfPathId]);

  // Show loading state (optional - can render nothing)
  if (loading && !compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  // If no actions available, don't render anything
  if (!availableActions) {
    return null;
  }

  const hasPoFile =
    mrf.unsigned_po_url ||
    mrf.unsignedPOUrl ||
    mrf.signed_po_url ||
    mrf.signedPOUrl;

  if (availableActions.readOnly) {
    const readOnlyButtons: JSX.Element[] = [];

    if (onDownloadPO && hasPoFile) {
      readOnlyButtons.push(
        <Button
          key="download-po"
          size={size}
          variant="outline"
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            onDownloadPO();
          }}
        >
          <Download className="h-3 w-3 mr-1" />
          {compact ? "PO" : "Download PO"}
        </Button>,
      );
    }

    // GRN generate/upload — allowed for LM when backend grants them
    if (availableActions.canGenerateGRN && onGenerateGRN) {
      readOnlyButtons.push(
        <Button
          key="generate-grn"
          size={size}
          variant={variant}
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            onGenerateGRN();
          }}
        >
          <FileCheck className="h-3 w-3 mr-1" />
          {compact ? "GRN" : "Generate GRN"}
        </Button>,
      );
    }

    if (availableActions.canUploadGRN && onUploadGRN) {
      readOnlyButtons.push(
        <Button
          key="upload-grn"
          size={size}
          variant={variant}
          className={className}
          onClick={(e) => {
            e.stopPropagation();
            onUploadGRN();
          }}
        >
          <Upload className="h-3 w-3 mr-1" />
          {compact ? "GRN" : "Upload GRN"}
        </Button>,
      );
    }

    if (readOnlyButtons.length === 0) return null;
    return <div className={`flex items-center gap-2 ${className}`}>{readOnlyButtons}</div>;
  }

  const buttons: JSX.Element[] = [];

  // Generate PO - Only for Procurement role
  if (availableActions.canGeneratePO && onGeneratePO && (getScmRole(user) === "procurement" || getScmRole(user) === "procurement_manager")) {
    buttons.push(
      <Button
        key="generate-po"
        size={size}
        variant={variant}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onGeneratePO();
        }}
      >
        <ShoppingCart className="h-3 w-3 mr-1" />
        {compact ? "PO" : "Generate PO"}
      </Button>
    );
  }

  // Download PO - If PO exists
  if (onDownloadPO && hasPoFile) {
    buttons.push(
      <Button
        key="download-po"
        size={size}
        variant="outline"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onDownloadPO();
        }}
      >
        <Download className="h-3 w-3 mr-1" />
        {compact ? "PO" : "Download PO"}
      </Button>
    );
  }

  // Generate GRN - Phase 2 (from line items). Procurement only.
  if (
    availableActions.canGenerateGRN &&
    onGenerateGRN &&
    (getScmRole(user) === "procurement" || getScmRole(user) === "procurement_manager")
  ) {
    buttons.push(
      <Button
        key="generate-grn"
        size={size}
        variant={variant}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onGenerateGRN();
        }}
      >
        <FileCheck className="h-3 w-3 mr-1" />
        {compact ? "GRN" : "Generate GRN"}
      </Button>
    );
  }

  // Upload GRN - Only for Procurement when GRN is requested
  if (availableActions.canUploadGRN && onUploadGRN && (getScmRole(user) === "procurement" || getScmRole(user) === "procurement_manager")) {
    buttons.push(
      <Button
        key="upload-grn"
        size={size}
        variant={variant}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onUploadGRN();
        }}
      >
        <Upload className="h-3 w-3 mr-1" />
        {compact ? "GRN" : "Upload GRN"}
      </Button>
    );
  }

  // Delete PO - Only for Procurement managers
  if (onDeletePO && (getScmRole(user) === "procurement_manager" || getScmRole(user) === "procurement")) {
    const hasPO = mrf.po_number || mrf.poNumber;
    if (hasPO && hasPO !== "N/A") {
      buttons.push(
        <Button
          key="delete-po"
          size={size}
          variant="ghost"
          className={`${className} text-destructive hover:text-destructive`}
          onClick={(e) => {
            e.stopPropagation();
            onDeletePO();
          }}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {compact ? "Del" : "Delete PO"}
        </Button>
      );
    }
  }

  // Delete MRF - Only for Procurement managers or requester (if allowed)
  if (onDeleteMRF) {
    const canDelete = availableActions.canEdit || 
      (getScmRole(user) === "procurement_manager" || getScmRole(user) === "procurement");
    
    if (canDelete) {
      buttons.push(
        <Button
          key="delete-mrf"
          size={size}
          variant="ghost"
          className={`${className} text-destructive hover:text-destructive`}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMRF();
          }}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {compact ? "Del" : "Delete"}
        </Button>
      );
    }
  }

  if (buttons.length === 0) {
    return null;
  }

  return <div className="flex items-center gap-2">{buttons}</div>;
};
