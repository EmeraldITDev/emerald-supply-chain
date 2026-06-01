import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Package, 
  AlertCircle,
  Loader2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mrfApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import type { PaymentSchedule, PaymentMilestone } from "@/types/payment-schedule";
import type { ProcurementDocumentsResponse } from "@/types/procurement-documents";

interface MRFProgressTrackerProps {
  mrfId: string;
  showTitle?: boolean;
  // Used to adjust workflow labels (e.g., Emerald Contract starts with Executive approval).
  contractType?: string | null;
  onProgressUpdate?: (progress: number) => void;
  // Phase 2: payment schedule drives milestone rows + 100% advance detection.
  paymentSchedule?: PaymentSchedule | null;
  // Phase 2: document registry drives completion for invoice / GRN / delivery docs.
  documentsByType?: ProcurementDocumentsResponse["documentsByType"];
  activeByType?: ProcurementDocumentsResponse["activeByType"];
  // Optional raw MRF timestamps used to compute per-stage durations. Only
  // fields present here are used; missing fields cause that stage's duration
  // line to be omitted (no fabricated data).
  stageTimestamps?: {
    created_at?: string;
    executive_approved_at?: string;
    director_approved_at?: string;
    procurement_review_started_at?: string;
    grn_completed_at?: string;
    payment_approved_at?: string;
    updated_at?: string;
    po_signed_at?: string;
    vendor_invoice_submitted_at?: string;
    grn_generated_at?: string;
    delivery_docs_uploaded_at?: string;
    finance_reviewed_at?: string;
    payment_completed_at?: string;
  };
}

interface ProgressStep {
  step: number;
  name: string;
  status: 'completed' | 'pending' | 'not_started';
  completedAt?: string;
  completedBy?: {
    id: number;
    name: string;
  };
  remarks?: string;
}

const formatDurationMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) {
    const mins = totalMinutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
};

type PhaseKey = "approval" | "sourcing" | "procurement" | "delivery" | "payment";

interface DisplayStep {
  key: string;
  phase: PhaseKey;
  name: string;
  status: "completed" | "pending" | "not_started";
  completedAt?: string;
  completedBy?: { id: number; name: string };
  remarks?: string;
  durationText?: string;
  meta?: string; // e.g. "₦120,000 • 30%"
  isCurrent?: boolean;
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  approval: "Approval",
  sourcing: "Sourcing",
  procurement: "Procurement",
  delivery: "Delivery",
  payment: "Payment",
};

const isFullAdvanceSchedule = (schedule?: PaymentSchedule | null): boolean => {
  if (!schedule?.milestones?.length) return false;
  if (schedule.milestones.length !== 1) return false;
  const m = schedule.milestones[0];
  const pct = typeof m.percentage === "string" ? Number(m.percentage) : m.percentage;
  return pct === 100 && m.triggerCondition === "on_advance";
};

const formatNaira = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === "") return "-";
  const n = typeof val === "string" ? Number(val) : val;
  if (!Number.isFinite(n)) return "-";
  return `₦${n.toLocaleString()}`;
};

export const MRFProgressTracker = ({
  mrfId,
  showTitle = true,
  contractType,
  onProgressUpdate,
  stageTimestamps,
  paymentSchedule,
  documentsByType: _documentsByType,
  activeByType,
}: MRFProgressTrackerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<{
    mrfId: string;
    title: string;
    currentStep: number;
    steps: ProgressStep[];
  } | null>(null);
  const [openPhases, setOpenPhases] = useState<Record<PhaseKey, boolean>>({
    approval: true,
    sourcing: false,
    procurement: false,
    delivery: false,
    payment: false,
  });

  const isEmeraldContract = (contractType || "").toLowerCase().includes("emerald");

  useEffect(() => {
    const fetchProgress = async () => {
      if (!mrfId) return;
      
      setLoading(true);
      try {
        const response = await mrfApi.getProgressTracker(mrfId);
        if (response.success && response.data) {
          setProgressData(response.data);
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to load progress tracker",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to fetch progress tracker:', error);
        toast({
          title: "Error",
          description: "Failed to load progress information",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [mrfId, toast]);

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Progress Tracker
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progressData) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Progress Tracker
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No progress data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success text-success-foreground border-success';
      case 'pending':
        return 'bg-warning text-warning-foreground border-warning animate-pulse';
      default:
        return 'bg-muted text-muted-foreground border-muted-foreground/30';
    }
  };

  const getLineStyles = (status: string, isLast: boolean) => {
    if (isLast) return '';
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'pending':
        return 'bg-gradient-to-r from-success to-warning';
      default:
        return 'bg-muted';
    }
  };

  // ===== Build phased step list =====
  const backendSteps = progressData.steps;
  const stepByNum = new Map(backendSteps.map((s) => [s.step, s]));
  const initialApprovalTs = isEmeraldContract
    ? stageTimestamps?.executive_approved_at
    : stageTimestamps?.director_approved_at;

  const durationBetween = (start?: string, end?: string, status?: string): string => {
    if (status === "completed" && start && end) {
      const t = formatDurationMs(new Date(end).getTime() - new Date(start).getTime());
      return t ? `Took: ${t}` : "";
    }
    if (status === "pending" && start) {
      const t = formatDurationMs(Date.now() - new Date(start).getTime());
      return t ? `Elapsed: ${t}` : "";
    }
    return "";
  };

  const fromBackend = (
    stepNum: number,
    phase: PhaseKey,
    overrideName?: string,
    duration?: string,
  ): DisplayStep | null => {
    const s = stepByNum.get(stepNum);
    if (!s) return null;
    return {
      key: `b-${stepNum}`,
      phase,
      name: overrideName ?? s.name,
      status: s.status,
      completedAt: s.completedAt,
      completedBy: s.completedBy,
      remarks: s.remarks,
      durationText: duration,
      isCurrent: s.status === "pending",
    };
  };

  const steps: DisplayStep[] = [];

  // APPROVAL
  const s1 = fromBackend(1, "approval");
  if (s1) steps.push(s1);
  const s2 = fromBackend(
    2,
    "approval",
    isEmeraldContract ? "Executive Approval (Initial)" : "Supply Chain Director Approval (Initial)",
    durationBetween(stageTimestamps?.created_at, initialApprovalTs, stepByNum.get(2)?.status),
  );
  if (s2) steps.push(s2);
  const s3 = fromBackend(
    3,
    "approval",
    undefined,
    durationBetween(initialApprovalTs, stageTimestamps?.procurement_review_started_at, stepByNum.get(3)?.status),
  );
  if (s3) steps.push(s3);

  // SOURCING
  const s4 = fromBackend(4, "sourcing");
  if (s4) steps.push(s4);
  const s5 = fromBackend(5, "sourcing");
  if (s5) steps.push(s5);
  const s6 = fromBackend(6, "sourcing", "Vendor Selection Approved");
  if (s6) steps.push(s6);

  // PROCUREMENT
  // Step 7 — Vendor Final Invoice (completion = activeByType.vendor_invoice; duration = timestamp)
  const invoiceDoc = activeByType?.vendor_invoice;
  const invoiceTs = stageTimestamps?.vendor_invoice_submitted_at;
  const invoiceStatus: DisplayStep["status"] = invoiceDoc
    ? "completed"
    : stepByNum.get(7)?.status === "pending"
      ? "pending"
      : "not_started";
  steps.push({
    key: "vendor-invoice",
    phase: "procurement",
    name: "Vendor Final Invoice Submitted",
    status: invoiceStatus,
    completedAt: invoiceTs ?? (invoiceDoc ? invoiceDoc.uploadedAt : undefined),
    completedBy: invoiceDoc?.uploadedBy
      ? { id: Number(invoiceDoc.uploadedBy.id) || 0, name: invoiceDoc.uploadedBy.name }
      : undefined,
    isCurrent: invoiceStatus === "pending",
  });

  const s7Backend = fromBackend(7, "procurement", "PO Generated");
  if (s7Backend) steps.push(s7Backend);

  // Step 9 — PO Signed by SCD (use backend step 8 if present)
  const signedPoDoc = activeByType?.signed_po;
  const s8Backend = stepByNum.get(8);
  const poSignedStatus: DisplayStep["status"] = signedPoDoc
    ? "completed"
    : (s8Backend?.status as DisplayStep["status"]) ?? "not_started";
  steps.push({
    key: "po-signed",
    phase: "procurement",
    name: "PO Signed by SCD",
    status: poSignedStatus,
    completedAt: stageTimestamps?.po_signed_at ?? s8Backend?.completedAt ?? signedPoDoc?.uploadedAt,
    completedBy: s8Backend?.completedBy,
    remarks: s8Backend?.remarks,
    isCurrent: poSignedStatus === "pending",
  });

  // DELIVERY — hidden entirely when payment schedule is 100% advance
  const hideDelivery = isFullAdvanceSchedule(paymentSchedule);
  if (!hideDelivery) {
    const grnDoc = activeByType?.grn;
    const grnStatus: DisplayStep["status"] = grnDoc ? "completed" : poSignedStatus === "completed" ? "pending" : "not_started";
    steps.push({
      key: "grn",
      phase: "delivery",
      name: "GRN / Goods Received",
      status: grnStatus,
      completedAt: stageTimestamps?.grn_generated_at ?? grnDoc?.uploadedAt,
      completedBy: grnDoc?.uploadedBy
        ? { id: Number(grnDoc.uploadedBy.id) || 0, name: grnDoc.uploadedBy.name }
        : undefined,
      isCurrent: grnStatus === "pending",
    });

    const deliveryDoc =
      activeByType?.waybill || activeByType?.jcc || activeByType?.delivery_confirmation;
    const deliveryStatus: DisplayStep["status"] = deliveryDoc
      ? "completed"
      : grnStatus === "completed"
        ? "pending"
        : "not_started";
    steps.push({
      key: "delivery-docs",
      phase: "delivery",
      name: "Delivery Documents Uploaded",
      status: deliveryStatus,
      completedAt: stageTimestamps?.delivery_docs_uploaded_at ?? deliveryDoc?.uploadedAt,
      completedBy: deliveryDoc?.uploadedBy
        ? { id: Number(deliveryDoc.uploadedBy.id) || 0, name: deliveryDoc.uploadedBy.name }
        : undefined,
      isCurrent: deliveryStatus === "pending",
    });
  }

  // PAYMENT
  const financeReviewTs = stageTimestamps?.finance_reviewed_at;
  const upstreamComplete = steps.every((s) => s.status === "completed");
  const financeStatus: DisplayStep["status"] = financeReviewTs
    ? "completed"
    : upstreamComplete
      ? "pending"
      : "not_started";
  steps.push({
    key: "finance-review",
    phase: "payment",
    name: "Finance Review",
    status: financeStatus,
    completedAt: financeReviewTs,
    isCurrent: financeStatus === "pending",
  });

  const milestones: PaymentMilestone[] = paymentSchedule?.milestones ?? [];
  if (milestones.length > 0) {
    milestones.forEach((m, idx) => {
      const status: DisplayStep["status"] =
        m.status === "paid" ? "completed" : m.status === "eligible" ? "pending" : "not_started";
      steps.push({
        key: `milestone-${m.id ?? idx}`,
        phase: "payment",
        name: m.label || `Milestone ${m.milestoneNumber}`,
        status,
        meta: `${formatNaira(m.amount ?? null)} • ${m.percentage}%`,
        isCurrent: status === "pending",
      });
    });
  } else {
    steps.push({
      key: "payment-generic",
      phase: "payment",
      name: "Payment",
      status: stageTimestamps?.payment_completed_at ? "completed" : "not_started",
      completedAt: stageTimestamps?.payment_completed_at,
    });
  }

  steps.push({
    key: "closed",
    phase: "payment",
    name: "Fully Paid / Closed",
    status: stageTimestamps?.payment_completed_at ? "completed" : "not_started",
    completedAt: stageTimestamps?.payment_completed_at,
  });

  // Overall progress
  const totalCount = steps.length;
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progressPercentage = totalCount ? Math.round((completedSteps / totalCount) * 100) : 0;

  // Notify parent
  if (onProgressUpdate) {
    // fire-and-forget on render; safe because parent stores into state
    queueMicrotask(() => onProgressUpdate(progressPercentage));
  }

  // Phase grouping
  const phaseOrder: PhaseKey[] = ["approval", "sourcing", "procurement", "delivery", "payment"];
  const phaseSteps: Record<PhaseKey, DisplayStep[]> = {
    approval: [],
    sourcing: [],
    procurement: [],
    delivery: [],
    payment: [],
  };
  steps.forEach((s) => phaseSteps[s.phase].push(s));

  const currentPhase: PhaseKey | undefined = steps.find((s) => s.status === "pending")?.phase;
  // Default-open the current phase on first render only (don't override user toggles)
  const effectiveOpen: Record<PhaseKey, boolean> = { ...openPhases };
  if (currentPhase && !openPhases[currentPhase]) {
    effectiveOpen[currentPhase] = true;
  }

  const phaseDotClass = (phase: PhaseKey): string => {
    const list = phaseSteps[phase];
    if (!list.length) return "bg-muted-foreground/30";
    const allDone = list.every((s) => s.status === "completed");
    const anyPending = list.some((s) => s.status === "pending");
    if (allDone) return "bg-success";
    if (anyPending) return "bg-warning";
    return "bg-muted-foreground/30";
  };

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Progress Tracker
          </CardTitle>
          <CardDescription>{progressData.title}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <Badge variant={progressPercentage === 100 ? "default" : "secondary"}>
                {progressPercentage}% Complete
              </Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Phased step indicators */}
          <div className="space-y-2">
            {phaseOrder.map((phase) => {
              const list = phaseSteps[phase];
              if (!list.length) return null;
              const doneInPhase = list.filter((s) => s.status === "completed").length;
              return (
                <Collapsible
                  key={phase}
                  open={effectiveOpen[phase]}
                  onOpenChange={(v) =>
                    setOpenPhases((prev) => ({ ...prev, [phase]: v }))
                  }
                  className="border border-border/60 rounded-lg overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", phaseDotClass(phase))} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {PHASE_LABELS[phase]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {doneInPhase}/{list.length}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        effectiveOpen[phase] && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-1.5">
                      {list.map((step, index) => {
                        const isLast = index === list.length - 1;
                        return (
                          <div key={step.key} className="flex items-start gap-3">
                            <div className="flex flex-col items-center pt-0.5">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                                  getStatusStyles(step.status),
                                )}
                              >
                                {step.status === "completed" ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : step.status === "pending" ? (
                                  <Clock className="h-4 w-4" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </div>
                              {!isLast && (
                                <div
                                  className={cn(
                                    "w-0.5 flex-1 mt-1 rounded",
                                    getLineStyles(step.status, isLast),
                                  )}
                                  style={{ minHeight: "24px" }}
                                />
                              )}
                            </div>
                            <div className="flex-1 pt-0.5 pb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{step.name}</span>
                                {step.meta && (
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {step.meta}
                                  </span>
                                )}
                                {step.isCurrent && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              {step.status === "completed" && step.completedAt && (
                                <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                  <p>
                                    {new Date(step.completedAt).toLocaleString("en-US", {
                                      timeZone: "Africa/Lagos",
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}
                                    {step.completedBy && <> • {step.completedBy.name}</>}
                                  </p>
                                  {step.remarks && (
                                    <p className="italic">"{step.remarks}"</p>
                                  )}
                                </div>
                              )}
                              {step.status === "pending" && !step.completedAt && (
                                <p className="text-xs text-muted-foreground mt-0.5">In progress…</p>
                              )}
                              {step.status === "not_started" && (
                                <p className="text-xs text-muted-foreground mt-0.5">Not started</p>
                              )}
                              {step.durationText && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                  {step.durationText}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
