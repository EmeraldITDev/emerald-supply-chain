import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { procurementApi } from "@/services/procurementApi";
import type { WorkflowGatesResponse } from "@/types/workflow-gates";

interface WorkflowGatesPanelProps {
  mrfId: string;
  /** Bumping this value forces a re-fetch (use after PO sign / GRN / uploads). */
  refreshKey?: number;
  className?: string;
}

const DOC_LABELS: Record<string, string> = {
  vendor_invoice: "Vendor Invoice",
  grn: "GRN",
  waybill: "Waybill",
  jcc: "JCC",
  pfi: "Proforma Invoice",
  delivery_confirmation: "Delivery Confirmation",
  signed_po: "Signed PO",
  po_pdf: "PO PDF",
};

const labelForDoc = (type: string) =>
  DOC_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const prettyState = (state: string) =>
  state ? state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

export const WorkflowGatesPanel = ({ mrfId, refreshKey = 0, className }: WorkflowGatesPanelProps) => {
  const [gates, setGates] = useState<WorkflowGatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGates = useCallback(async () => {
    if (!mrfId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await procurementApi.getWorkflowGates(mrfId);
      if (res.success && res.data) {
        setGates(res.data);
      } else {
        setError(res.error || "Failed to load workflow gates");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load workflow gates");
    } finally {
      setLoading(false);
    }
  }, [mrfId]);

  useEffect(() => {
    fetchGates();
  }, [fetchGates, refreshKey]);

  if (loading && !gates) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !gates) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between gap-3">
          <span>{error ?? "No workflow data."}</span>
          <Button size="sm" variant="outline" onClick={fetchGates}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { usesFinanceAp, workflowState, vendorInvoiceGate, deliveryConfirmation, closureReadiness } = gates;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Workflow Gates
              {usesFinanceAp ? (
                <Badge variant="secondary" className="text-[10px]">Finance AP</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Legacy</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              State: <span className="font-medium">{prettyState(workflowState)}</span>
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchGates} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Vendor Invoice Gate */}
        <section className="space-y-1.5">
          <div className="flex items-center gap-2">
            {vendorInvoiceGate.canSubmit ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Vendor Invoice</span>
            {vendorInvoiceGate.gateType && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {vendorInvoiceGate.gateType}
              </Badge>
            )}
            <Badge
              variant={vendorInvoiceGate.canSubmit ? "default" : "secondary"}
              className="text-[10px] ml-auto"
            >
              {vendorInvoiceGate.canSubmit ? "Open" : "Locked"}
            </Badge>
          </div>
          {vendorInvoiceGate.reason && (
            <p className="text-xs text-muted-foreground pl-6">{vendorInvoiceGate.reason}</p>
          )}
        </section>

        {/* Delivery Confirmation */}
        {deliveryConfirmation.required && (
          <section className="space-y-1.5">
            <div className="flex items-center gap-2">
              {deliveryConfirmation.satisfied ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Clock className="h-4 w-4 text-warning" />
              )}
              <span className="text-sm font-medium">Delivery Confirmation</span>
              <Badge
                variant={deliveryConfirmation.satisfied ? "default" : "secondary"}
                className="text-[10px] ml-auto"
              >
                {deliveryConfirmation.satisfied ? "Satisfied" : "Pending"}
              </Badge>
            </div>

            {(deliveryConfirmation.requiredDocuments?.length ?? 0) > 0 && (
              <ul className="pl-6 space-y-1">
                {deliveryConfirmation.requiredDocuments!.map((doc) => {
                  const missing = (deliveryConfirmation.missingDocuments ?? []).includes(doc);
                  return (
                    <li
                      key={doc}
                      className="text-xs flex items-center gap-2 text-muted-foreground"
                    >
                      {missing ? (
                        <XCircle className="h-3.5 w-3.5 text-warning" />
                      ) : (
                        <FileCheck className="h-3.5 w-3.5 text-success" />
                      )}
                      <span className={cn(!missing && "line-through opacity-70")}>
                        {labelForDoc(doc)}
                      </span>
                      {missing && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          Missing
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Closure Readiness */}
        <section className="space-y-1.5">
          <div className="flex items-center gap-2">
            {closureReadiness.canClose ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning" />
            )}
            <span className="text-sm font-medium">Closure</span>
            <Badge
              variant={closureReadiness.canClose ? "default" : "secondary"}
              className="text-[10px] ml-auto"
            >
              {closureReadiness.canClose ? "Ready" : "Blocked"}
            </Badge>
          </div>

          {!closureReadiness.canClose && (closureReadiness.blockers?.length ?? 0) > 0 && (
            <Alert variant="default" className="mt-2 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs">Cannot close yet</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                  {closureReadiness.blockers!.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {(closureReadiness.milestoneSummary?.length ?? 0) > 0 && (
            <div className="pl-6 mt-2 space-y-1">
              {closureReadiness.milestoneSummary!.map((m) => (
                <div
                  key={m.milestoneNumber}
                  className="text-xs flex items-center gap-2 flex-wrap"
                >
                  <span className="font-medium">
                    M{m.milestoneNumber}. {m.label}
                  </span>
                  <span className="text-muted-foreground">({m.percentage}%)</span>
                  <Badge
                    variant={m.paid ? "default" : "secondary"}
                    className="text-[10px] ml-auto"
                  >
                    {m.paid ? "Paid" : m.invoiceReceived ? "Invoice In" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
};

export default WorkflowGatesPanel;