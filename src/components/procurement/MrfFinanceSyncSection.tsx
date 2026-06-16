import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import FinanceSyncPanel from "./FinanceSyncPanel";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

interface MrfFinanceSyncSectionProps {
  mrfId: string;
  mrf?: MRF | null;
  refreshKey?: number;
  className?: string;
}

/**
 * Shows Finance AP sync when the user may view it (Phase 7 available-actions)
 * or when the MRF is Finance AP–routed.
 */
export const MrfFinanceSyncSection = ({
  mrfId,
  mrf,
  refreshKey = 0,
  className,
}: MrfFinanceSyncSectionProps) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!mrfId) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!mrf) {
        if (!cancelled) setVisible(true);
        return;
      }
      const res = await mrfApi.getAvailableActions(mrfId, {
        mrf,
        userRole: getScmRole(user),
      });
      if (cancelled) return;
      if (res.success && res.data) {
        setVisible(
          Boolean(res.data.canViewFinanceSync) ||
            Boolean(res.data.usesFinanceAp) ||
            res.data.availableActions?.includes("view_finance_sync"),
        );
      } else {
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mrfId, mrf, getScmRole(user)]);

  if (visible === false) return null;
  if (visible === null) return null;

  return (
    <FinanceSyncPanel
      mrfId={mrfId}
      refreshKey={refreshKey}
      className={className}
      hideWhenLegacy={false}
    />
  );
};

export default MrfFinanceSyncSection;
