import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ChevronDown,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mrfApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import { WORKFLOW_QUERY_OPTIONS } from "@/lib/queryOptions";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import type { PaymentSchedule } from "@/types/payment-schedule";
import type { ProcurementDocumentsResponse } from "@/types/procurement-documents";
import type {
  ProgressTrackerStageTimestamps,
  ProgressPhaseKey,
} from "@/types/progress-tracker";

interface MRFProgressTrackerProps {
  mrfId: string;
  showTitle?: boolean;
  contractType?: string | null;
  onProgressUpdate?: (progress: number) => void;
  paymentSchedule?: PaymentSchedule | null;
  documentsByType?: ProcurementDocumentsResponse["documentsByType"];
  activeByType?: ProcurementDocumentsResponse["activeByType"];
  stageTimestamps?: ProgressTrackerStageTimestamps;
}

export const MRFProgressTracker = ({
  mrfId,
  showTitle = true,
  contractType,
  onProgressUpdate,
  stageTimestamps: propTimestamps,
  paymentSchedule: propSchedule,
  documentsByType: _documentsByType,
  activeByType: propActiveByType,
}: MRFProgressTrackerProps) => {
  const { toast } = useToast();
  const [openPhases, setOpenPhases] = useState<Partial<Record<ProgressPhaseKey, boolean>>>({
    approval: true,
  });

  const {
    data: viewModel,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.mrfs.progressTracker(mrfId),
    queryFn: async () => {
      const response = await mrfApi.getProgressTracker(mrfId, {
        contractType,
        propPaymentSchedule: propSchedule,
        propActiveByType: propActiveByType,
        propStageTimestamps: propTimestamps,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load progress tracker");
      }
      return response.data;
    },
    enabled: Boolean(mrfId),
    ...WORKFLOW_QUERY_OPTIONS,
  });

  useEffect(() => {
    if (queryError) {
      toast({
        title: "Error",
        description:
          queryError instanceof Error ? queryError.message : "Failed to load progress information",
        variant: "destructive",
      });
    }
  }, [queryError, toast]);

  useEffect(() => {
    if (viewModel && onProgressUpdate) {
      onProgressUpdate(viewModel.progressPercent);
    }
  }, [viewModel, onProgressUpdate]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-foreground border-success";
      case "pending":
        return "bg-warning text-warning-foreground border-warning animate-pulse";
      default:
        return "bg-muted text-muted-foreground border-muted-foreground/30";
    }
  };

  const getLineStyles = (status: string, isLast: boolean) => {
    if (isLast) return "";
    switch (status) {
      case "completed":
        return "bg-success";
      case "pending":
        return "bg-gradient-to-r from-success to-warning";
      default:
        return "bg-muted";
    }
  };

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
          <TableSkeleton rows={3} />
        </CardContent>
      </Card>
    );
  }

  if (!viewModel) {
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

  const currentPhase = viewModel.phases
    .flatMap((p) => p.steps.map((s) => ({ phase: p.id, step: s })))
    .find(({ step }) => step.status === "pending")?.phase;

  const effectiveOpen: Record<string, boolean> = {};
  viewModel.phases.forEach((p) => {
    effectiveOpen[p.id] =
      openPhases[p.id] ?? (p.id === currentPhase || p.id === "approval");
  });
  if (currentPhase) effectiveOpen[currentPhase] = true;

  const phaseDotClass = (phaseId: ProgressPhaseKey): string => {
    const phase = viewModel.phases.find((p) => p.id === phaseId);
    if (!phase?.steps.length) return "bg-muted-foreground/30";
    const allDone = phase.steps.every((s) => s.status === "completed");
    const anyPending = phase.steps.some((s) => s.status === "pending");
    if (allDone) return "bg-success";
    if (anyPending) return "bg-warning";
    return "bg-muted-foreground/30";
  };

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Package className="h-5 w-5" />
            Progress Tracker
            {viewModel.usesFinanceAp ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                <Landmark className="h-3 w-3 mr-1" />
                Finance AP
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-normal">
                Legacy
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{viewModel.title}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <Badge
                variant={viewModel.progressPercent === 100 ? "default" : "secondary"}
              >
                {viewModel.progressPercent}% Complete
              </Badge>
            </div>
            <Progress value={viewModel.progressPercent} className="h-2" />
          </div>

          <div className="space-y-2">
            {viewModel.phases.map((phase) => (
              <Collapsible
                key={phase.id}
                open={effectiveOpen[phase.id]}
                onOpenChange={(v) =>
                  setOpenPhases((prev) => ({ ...prev, [phase.id]: v }))
                }
                className="border border-border/60 rounded-lg overflow-hidden"
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", phaseDotClass(phase.id))} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {phase.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {phase.completedSteps}/{phase.totalSteps}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      effectiveOpen[phase.id] && "rotate-180",
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 space-y-1.5">
                    {phase.steps.map((step, index) => {
                      const isLast = index === phase.steps.length - 1;
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
                            {step.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {step.description}
                              </p>
                            )}
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
                                  <p className="italic">&quot;{step.remarks}&quot;</p>
                                )}
                              </div>
                            )}
                            {step.status === "completed" && !step.completedAt && (
                              <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
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
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
