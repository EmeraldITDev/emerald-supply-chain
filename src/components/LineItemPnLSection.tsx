import { useEffect, useState } from "react";
import { ProfitAndLossTable } from "@/components/ProfitAndLossTable";
import { mrfApi, srfApi } from "@/services/api";
import type { ProfitAndLoss } from "@/types";
import { normalizeProfitAndLoss } from "@/utils/normalizeProfitAndLoss";

interface LineItemPnLSectionProps {
  type: "mrf" | "srf";
  id: string;
  /** When detail payload already includes profitAndLoss, skip initial fetch. */
  initialPnL?: ProfitAndLoss;
}

export function LineItemPnLSection({ type, id, initialPnL }: LineItemPnLSectionProps) {
  // Bug B — even pre-baked detail payloads may arrive in mixed casing; normalize.
  const normalizedInitial = initialPnL ? normalizeProfitAndLoss(initialPnL) : undefined;
  const [pnl, setPnl] = useState<ProfitAndLoss | undefined>(normalizedInitial);
  const [loading, setLoading] = useState(!normalizedInitial || normalizedInitial.items.length === 0);

  useEffect(() => {
    const seed = initialPnL ? normalizeProfitAndLoss(initialPnL) : undefined;
    setPnl(seed);
    // If the embedded payload already has items, trust it.
    if (seed && seed.items.length > 0) {
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
