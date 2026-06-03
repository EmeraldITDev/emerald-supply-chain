import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Landmark, CheckCircle } from "lucide-react";
import { getDisplayId } from "@/utils/displayId";
import { OneDriveLink } from "@/components/OneDriveLink";
import { displayString, formatAmount } from "@/utils/normalizeQuotation";
import type { FinanceMRFRow } from "@/types";
import type { MRF } from "@/types";
import { getMrfFromFinanceRow } from "@/types/finance-dashboard";
import { FinanceInternalPaymentButtons } from "./FinanceInternalPaymentButtons";

const prettyWorkflow = (s?: string | null) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

interface FinanceMRFCardProps {
  row: FinanceMRFRow;
  onRefresh?: () => void;
}

export const FinanceMRFCard = ({ row, onRefresh }: FinanceMRFCardProps) => {
  const mrf = getMrfFromFinanceRow(row);
  const vendor = (row as FinanceMRFRow & { vendor?: { name?: string; email?: string } }).vendor || {};
  const q = (row as FinanceMRFRow & { quotation?: Record<string, unknown> }).quotation ?? {};
  const po = (row as FinanceMRFRow & { po?: Record<string, unknown> }).po || {};

  const rawAmount =
    q.totalAmount ?? q.total_amount ?? q.total_order_value ?? q.totalOrderValue ?? q.price;
  const quotationAmount =
    rawAmount != null && rawAmount !== "" ? Number(rawAmount) : null;
  const hasQuotationAmount = quotationAmount !== null && !Number.isNaN(quotationAmount);

  const estimatedCost = parseFloat(String(mrf.estimated_cost || mrf.estimatedCost || "0"));
  const dateStr = mrf.created_at || mrf.date || "";
  const executiveApproved = mrf.executive_approved || (mrf as { executiveApproved?: boolean }).executiveApproved;

  const formatDate = () => {
    if (!dateStr) return "N/A";
    try {
      const normalized =
        dateStr.includes("Z") || dateStr.match(/[+-]\d{2}:\d{2}$/)
          ? dateStr
          : dateStr.includes("T")
            ? dateStr + "Z"
            : dateStr;
      const date = new Date(normalized);
      return isNaN(date.getTime())
        ? "Invalid Date"
        : date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 border rounded-xl bg-card hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="font-semibold text-lg">{mrf.title}</h3>
          <Badge variant="outline">{getDisplayId(mrf)}</Badge>
          {row.usesFinanceAp ? (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Landmark className="h-3 w-3 mr-1" />
              Finance AP
            </Badge>
          ) : (
            <Badge variant="secondary">Legacy internal</Badge>
          )}
          {row.workflowState && (
            <Badge variant="outline" className="text-xs">
              {prettyWorkflow(row.workflowState)}
            </Badge>
          )}
          {executiveApproved && (
            <Badge className="bg-success/10 text-success border-success/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Executive Approved
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Category</p>
            <p className="font-medium capitalize">{mrf.category?.replace("-", " ") || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Estimated Cost</p>
            <p className="font-medium">₦{estimatedCost.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Date</p>
            <p className="font-medium">{formatDate()}</p>
          </div>
          {row.usesFinanceAp && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">FA Status</p>
              <p className="font-medium">{prettyWorkflow(row.financeApStatus)}</p>
            </div>
          )}
        </div>

        {vendor?.name && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 text-sm">
            <span className="text-muted-foreground">Vendor: </span>
            <span className="font-medium">{vendor.name}</span>
          </div>
        )}

        {hasQuotationAmount && (
          <div className="bg-success/5 border border-success/20 rounded-lg p-3 mb-4 text-sm">
            <span className="text-muted-foreground">Quotation: </span>
            <span className="font-bold">
              {formatAmount(quotationAmount, (q.currency ?? q.currency_code ?? "NGN") as string)}
            </span>
            <span className="text-muted-foreground ml-2">
              · {displayString(q.payment_terms as string)}
            </span>
          </div>
        )}

        {(po.po_number || po.signed_po_url) && (
          <div className="bg-accent/50 border border-border rounded-lg p-3 mb-4 text-sm">
            {po.po_number && (
              <div>
                <span className="text-muted-foreground">PO: </span>
                <span className="font-mono">{String(po.po_number)}</span>
              </div>
            )}
          </div>
        )}

        {mrf.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{mrf.description}</p>
        )}
      </div>

      <div className="flex gap-2 items-center flex-wrap border-t pt-4">
        {row.usesFinanceAp && row.financeSyncPath && (
          <Button size="sm" variant="default" asChild>
            <Link to={row.financeSyncPath}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Finance AP sync
            </Link>
          </Button>
        )}

        {!row.usesFinanceAp && (
          <FinanceInternalPaymentButtons
            mrf={mrf as MRF}
            canProcessPaymentInternal={row.canProcessPaymentInternal}
            onSuccess={onRefresh}
          />
        )}

        {(mrf.signed_po_share_url || mrf.signed_po_url || po.signed_po_url) && (
          <OneDriveLink
            webUrl={
              (mrf.signed_po_share_url ||
                mrf.signedPOShareUrl ||
                mrf.signed_po_url ||
                po.signed_po_url) as string
            }
            fileName={`Signed PO-${mrf.po_number || po.po_number || "N/A"}.pdf`}
            variant="badge"
          />
        )}

        <Button size="sm" variant="outline" type="button">
          <Download className="h-4 w-4 mr-1" />
          Documents
        </Button>
      </div>
    </div>
  );
};

export default FinanceMRFCard;
