import { useEffect, useState } from "react";
import { ProfitAndLossTable } from "@/components/ProfitAndLossTable";
import { mrfApi, srfApi } from "@/services/api";
import type { ProfitAndLoss } from "@/types";

interface LineItemPnLSectionProps {
  type: "mrf" | "srf";
  id: string;
  /** When detail payload already includes profitAndLoss, skip initial fetch. */
  initialPnL?: ProfitAndLoss;
}

export function LineItemPnLSection({ type, id, initialPnL }: LineItemPnLSectionProps) {
  const [pnl, setPnl] = useState<ProfitAndLoss | undefined>(initialPnL);
  const [loading, setLoading] = useState(!initialPnL);

  useEffect(() => {
    setPnl(initialPnL);
    if (initialPnL) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res =
          type === "mrf"
            ? await mrfApi.getLineItemPnL(id)
            : await srfApi.getLineItemPnL(id);
        if (!cancelled && res.success && res.data) {
          setPnl(res.data);
        }
      } catch {
        if (!cancelled) setPnl(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [type, id, initialPnL]);

  return <ProfitAndLossTable pnl={pnl} isLoading={loading} />;
}
