import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { mrfApi } from "@/services/api";
import { getMrfApiId } from "@/utils/displayId";
import type { MRF } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

interface FinanceInternalPaymentButtonsProps {
  mrf: MRF;
  canProcessPaymentInternal?: boolean;
  onSuccess?: () => void;
}

export const FinanceInternalPaymentButtons = ({
  mrf,
  canProcessPaymentInternal = true,
  onSuccess,
}: FinanceInternalPaymentButtonsProps) => {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);

  if (!canProcessPaymentInternal) return null;

  const stage = (mrf.current_stage || mrf.currentStage || "").toLowerCase();
  const status = (mrf.status || "").toLowerCase();
  const isChairmanPayment =
    stage === "chairman_payment" || status.includes("payment pending chairman");
  const isFinanceProcess =
    stage.includes("finance") ||
    status === "processing payment" ||
    status.includes("pending payment");

  const canProcess =
    ["finance", "finance_officer", "admin"].includes(getScmRole(user) || "") && isFinanceProcess;
  const canApprove =
    getScmRole(user) === "chairman" && isChairmanPayment;

  if (!canProcess && !canApprove) return null;

  const mrfId = getMrfApiId(mrf);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await mrfApi.processPayment(mrfId);
      if (res.success) {
        toast.success("Payment processing started");
        onSuccess?.();
      } else {
        toast.error(res.error || "Failed to process payment");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await mrfApi.approvePayment(mrfId);
      if (res.success) {
        toast.success("Payment approved");
        onSuccess?.();
      } else {
        toast.error(res.error || "Failed to approve payment");
      }
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canProcess && (
        <Button size="sm" onClick={handleProcess} disabled={processing}>
          {processing ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Receipt className="h-4 w-4 mr-1" />
          )}
          Process Payment
        </Button>
      )}
      {canApprove && (
        <Button size="sm" variant="secondary" onClick={handleApprove} disabled={approving}>
          {approving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-1" />
          )}
          Approve Payment
        </Button>
      )}
    </div>
  );
};

export default FinanceInternalPaymentButtons;
