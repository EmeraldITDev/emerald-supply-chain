import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriceComparison } from "@/utils/poHelpers";
import type { PaymentSchedule } from "@/types/payment-schedule";
import { formatScheduleSummary } from "@/types/payment-schedule";

interface PriceComparisonTableProps {
  po: any;
  className?: string;
  /**
   * Optional MRF-level payment schedule. When supplied, rendered as a banner
   * above the table; also drives the default "Payment Terms" cell when the
   * row itself does not carry per-vendor payment-term metadata.
   */
  paymentSchedule?: PaymentSchedule | null;
}

const fmt = (n: number) =>
  `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/**
 * Price-comparison breakdown shown on the PO detail / approval screen.
 * Selected vendor row is highlighted with a left border + tinted background
 * using the success semantic token.
 */
export function PriceComparisonTable({
  po,
  className,
  paymentSchedule = null,
}: PriceComparisonTableProps) {
  const rows = getPriceComparison(po);

  const scheduleSummary = paymentSchedule
    ? paymentSchedule.summary ||
      formatScheduleSummary(paymentSchedule.milestones) ||
      ''
    : '';

  return (
    <section
      aria-labelledby="price-comparison-heading"
      className={cn("rounded-lg border bg-card", className)}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h3
          id="price-comparison-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Price Comparison
        </h3>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "vendor" : "vendors"}
        </span>
      </header>

      {paymentSchedule ? (
        <div className="border-b bg-muted/30 px-4 py-2 text-xs">
          <span className="font-medium text-foreground">
            Payment schedule
            {paymentSchedule.templateName ? ` · ${paymentSchedule.templateName}` : ''}
            {paymentSchedule.isLocked ? ' (locked)' : ''}:
          </span>{' '}
          <span className="text-muted-foreground">{scheduleSummary || '—'}</span>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex items-start gap-3 m-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle
            className="h-4 w-4 mt-0.5 text-warning shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium text-foreground">
              No price comparison data available for this PO
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add at least one vendor quote before submitting for approval.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Vendor</th>
                <th className="px-4 py-2 text-left font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Payment Terms</th>
                <th className="px-4 py-2 text-center font-medium">Selected</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i) => {
                const rowTerms =
                  r.paymentScheduleSummary ||
                  r.payment_schedule_summary ||
                  r.paymentTerms ||
                  r.payment_terms ||
                  scheduleSummary ||
                  '—';
                return (
                <tr
                  key={`${r.vendorName}-${i}`}
                  className={cn(
                    "border-t",
                    r.selected
                      ? "border-l-4 border-l-success bg-success/5"
                      : "hover:bg-muted/30",
                  )}
                >
                  <td className="px-4 py-2 font-medium">{r.vendorName}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.itemDescription || "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {fmt(r.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.quantity || "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {fmt(r.totalPrice)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{rowTerms}</td>
                  <td className="px-4 py-2 text-center">
                    {r.selected ? (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-success/15 text-success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Selected</span>
                      </span>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.selected ? r.selectionReason || "—" : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}