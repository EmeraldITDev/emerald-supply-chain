import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriceComparison } from "@/utils/poHelpers";

interface PriceComparisonTableProps {
  po: any;
  className?: string;
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
}: PriceComparisonTableProps) {
  const rows = getPriceComparison(po);

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
                <th className="px-4 py-2 text-center font-medium">Selected</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}