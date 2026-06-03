import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText, 
  Package, 
  Truck,
  DollarSign,
  AlertCircle,
  XCircle,
  Loader2,
  Send,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SRF } from "@/types";
import { getSrfStatusLabel } from "@/utils/srfStatusBadge";

function effectiveSrfWorkflowStatus(srf: SRF): string {
  const status = String(srf.status || "Pending").trim();
  const stageRaw = srf.current_stage ?? srf.currentStage ?? "";
  const stage = String(stageRaw).toLowerCase();
  if (
    status === "Completed" ||
    status === "Rejected" ||
    status === "In Progress"
  ) {
    return status;
  }
  if (
    stage.includes("paid") ||
    stage.includes("completed") ||
    stage.includes("grn_complete")
  ) {
    return "Completed";
  }
  if (stage.includes("reject")) return "Rejected";
  if (
    stage.includes("po_generated") ||
    stage.includes("po_") ||
    stage.includes("finance") ||
    stage.includes("payment") ||
    stage.includes("processing_payment")
  ) {
    return "In Progress";
  }
  if (
    stage.includes("procurement") ||
    stage.includes("rfq") ||
    stage.includes("quote") ||
    stage.includes("vendor") ||
    stage.includes("final_approval") ||
    stage.includes("scd_approved") ||
    stage.includes("supply_chain_director_approved")
  ) {
    return "Approved";
  }
  return status;
}

interface SRFProgressTrackerProps {
  srf: SRF;
  showTitle?: boolean;
}

interface ProgressStep {
  step: number;
  name: string;
  status: 'completed' | 'pending' | 'not_started';
  icon: React.ReactNode;
}

export const SRFProgressTracker = ({ srf, showTitle = true }: SRFProgressTrackerProps) => {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [progressPercentage, setProgressPercentage] = useState(0);

  useEffect(() => {
    // Determine the current step based on SRF status
    const determineSteps = () => {
      const statusMap: Record<string, ProgressStep[]> = {
        'Pending': [
          { step: 1, name: "SRF Created", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 2, name: "Awaiting Supply Chain Director Approval", status: 'pending', icon: <User className="h-4 w-4" /> },
          { step: 3, name: "Procurement Sourcing", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 4, name: "Vendor Quotes Received", status: 'not_started', icon: <Package className="h-4 w-4" /> },
          { step: 5, name: "Quotes Sent for Approval", status: 'not_started', icon: <Clock className="h-4 w-4" /> },
          { step: 6, name: "PO Generation", status: 'not_started', icon: <DollarSign className="h-4 w-4" /> },
          { step: 7, name: "PO Sent for Signing", status: 'not_started', icon: <FileText className="h-4 w-4" /> },
          { step: 8, name: "Vendor Notified", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 9, name: "Complete", status: 'not_started', icon: <CheckCircle2 className="h-4 w-4" /> },
        ],
        'Approved': [
          { step: 1, name: "SRF Created", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 2, name: "Supply Chain Director Approval", status: 'completed', icon: <User className="h-4 w-4" /> },
          { step: 3, name: "Procurement Sourcing", status: 'pending', icon: <Send className="h-4 w-4" /> },
          { step: 4, name: "Vendor Quotes Received", status: 'not_started', icon: <Package className="h-4 w-4" /> },
          { step: 5, name: "Quotes Sent for Approval", status: 'not_started', icon: <Clock className="h-4 w-4" /> },
          { step: 6, name: "PO Generation", status: 'not_started', icon: <DollarSign className="h-4 w-4" /> },
          { step: 7, name: "PO Sent for Signing", status: 'not_started', icon: <FileText className="h-4 w-4" /> },
          { step: 8, name: "Vendor Notified", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 9, name: "Complete", status: 'not_started', icon: <CheckCircle2 className="h-4 w-4" /> },
        ],
        'Rejected': [
          { step: 1, name: "SRF Created", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 2, name: "Supply Chain Director Approval", status: 'not_started', icon: <User className="h-4 w-4" /> },
          { step: 3, name: "Procurement Sourcing", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 4, name: "Vendor Quotes Received", status: 'not_started', icon: <Package className="h-4 w-4" /> },
          { step: 5, name: "Quotes Sent for Approval", status: 'not_started', icon: <Clock className="h-4 w-4" /> },
          { step: 6, name: "PO Generation", status: 'not_started', icon: <DollarSign className="h-4 w-4" /> },
          { step: 7, name: "PO Sent for Signing", status: 'not_started', icon: <FileText className="h-4 w-4" /> },
          { step: 8, name: "Vendor Notified", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 9, name: "Complete", status: 'not_started', icon: <XCircle className="h-4 w-4" /> },
        ],
        'In Progress': [
          { step: 1, name: "SRF Created", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 2, name: "Supply Chain Director Approval", status: 'completed', icon: <User className="h-4 w-4" /> },
          { step: 3, name: "Procurement Sourcing", status: 'completed', icon: <Send className="h-4 w-4" /> },
          { step: 4, name: "Vendor Quotes Received", status: 'completed', icon: <Package className="h-4 w-4" /> },
          { step: 5, name: "Quotes Sent for Approval", status: 'completed', icon: <Clock className="h-4 w-4" /> },
          { step: 6, name: "PO Generation", status: 'pending', icon: <DollarSign className="h-4 w-4" /> },
          { step: 7, name: "PO Sent for Signing", status: 'not_started', icon: <FileText className="h-4 w-4" /> },
          { step: 8, name: "Vendor Notified", status: 'not_started', icon: <Send className="h-4 w-4" /> },
          { step: 9, name: "Complete", status: 'not_started', icon: <CheckCircle2 className="h-4 w-4" /> },
        ],
        'Completed': [
          { step: 1, name: "SRF Created", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 2, name: "Supply Chain Director Approval", status: 'completed', icon: <User className="h-4 w-4" /> },
          { step: 3, name: "Procurement Sourcing", status: 'completed', icon: <Send className="h-4 w-4" /> },
          { step: 4, name: "Vendor Quotes Received", status: 'completed', icon: <Package className="h-4 w-4" /> },
          { step: 5, name: "Quotes Sent for Approval", status: 'completed', icon: <Clock className="h-4 w-4" /> },
          { step: 6, name: "PO Generation", status: 'completed', icon: <DollarSign className="h-4 w-4" /> },
          { step: 7, name: "PO Sent for Signing", status: 'completed', icon: <FileText className="h-4 w-4" /> },
          { step: 8, name: "Vendor Notified", status: 'completed', icon: <Send className="h-4 w-4" /> },
          { step: 9, name: "Complete", status: 'completed', icon: <CheckCircle2 className="h-4 w-4" /> },
        ],
      };

      const effective = effectiveSrfWorkflowStatus(srf);
      const currentSteps = statusMap[effective] || statusMap[srf.status] || statusMap['Pending'];
      const completedCount = currentSteps.filter(s => s.status === 'completed').length;
      const progress = Math.round((completedCount / currentSteps.length) * 100);
      
      setSteps(currentSteps);
      setProgressPercentage(progress);
    };

    determineSteps();
  }, [srf.status, srf.current_stage, srf.currentStage]);

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

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            SRF Progress Tracker
          </CardTitle>
          <CardDescription>{srf.title}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <Badge variant={progressPercentage === 100 ? "default" : "secondary"}>
                {progressPercentage}% Complete
              </Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const isCurrent = step.status === 'pending';

              return (
                <div key={step.step} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div 
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                        getStatusStyles(step.status)
                      )}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : step.status === 'pending' ? (
                        <Clock className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    {!isLast && (
                      <div 
                        className={cn(
                          "w-0.5 flex-1 mt-2 rounded",
                          getLineStyles(step.status, isLast)
                        )}
                        style={{ minHeight: '40px' }}
                      />
                    )}
                  </div>
                  
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {step.name}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    {step.status === 'completed' && (
                      <p className="text-xs text-muted-foreground">Completed</p>
                    )}
                    {step.status === 'pending' && (
                      <p className="text-xs text-muted-foreground">In progress...</p>
                    )}
                    {step.status === 'not_started' && (
                      <p className="text-xs text-muted-foreground">Not started</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
