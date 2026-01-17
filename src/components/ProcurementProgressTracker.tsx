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
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MRFRequest } from "@/contexts/AppContext";

interface ProcurementProgressTrackerProps {
  mrfRequests: MRFRequest[];
  showTitle?: boolean;
}

interface ProgressStage {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending' | 'rejected';
}

const getStagesForMRF = (mrf: MRFRequest): ProgressStage[] => {
  const stage = mrf.currentStage?.toLowerCase() || '';
  const status = mrf.status?.toLowerCase() || '';
  
  const stages: ProgressStage[] = [
    {
      id: 'mrf',
      name: 'MRF Created',
      shortName: 'MRF',
      icon: <FileText className="h-4 w-4" />,
      status: 'completed'
    },
    {
      id: 'executive',
      name: 'Executive Approval',
      shortName: 'Exec',
      icon: <CheckCircle2 className="h-4 w-4" />,
      status: 'pending'
    },
    {
      id: 'pfi',
      name: 'Proforma Invoice (PFI)',
      shortName: 'PFI',
      icon: <FileText className="h-4 w-4" />,
      status: 'pending'
    },
    {
      id: 'po',
      name: 'Purchase Order (PO)',
      shortName: 'PO',
      icon: <Package className="h-4 w-4" />,
      status: 'pending'
    },
    {
      id: 'grn',
      name: 'Goods Received (GRN)',
      shortName: 'GRN',
      icon: <Truck className="h-4 w-4" />,
      status: 'pending'
    },
    {
      id: 'payment',
      name: 'Payment Complete',
      shortName: 'Paid',
      icon: <DollarSign className="h-4 w-4" />,
      status: 'pending'
    }
  ];

  // Determine stage statuses based on MRF state
  if (status.includes('rejected') || stage === 'rejected') {
    // Find which stage was rejected
    if (status.includes('executive')) {
      stages[1].status = 'rejected';
    } else if (status.includes('chairman')) {
      stages[1].status = 'completed';
      stages[2].status = 'rejected';
    } else {
      stages[1].status = 'rejected';
    }
    return stages;
  }

  // MRF Created - always completed if exists
  stages[0].status = 'completed';

  // Executive Approval
  if (stage === 'executive' || status.includes('pending executive')) {
    stages[1].status = 'current';
    return stages;
  } else if (
    status.includes('approved by executive') || 
    status.includes('chairman approved') ||
    stage === 'procurement' ||
    stage === 'supply_chain' ||
    stage === 'finance' ||
    stage === 'completed'
  ) {
    stages[1].status = 'completed';
  }

  // Chairman approval for high-value (treated as part of executive stage)
  if (stage === 'chairman') {
    stages[1].status = 'current';
    return stages;
  }

  // PFI Stage (RFQ/Quote phase)
  if ((mrf as any).rfqId || status.includes('rfq')) {
    stages[2].status = 'completed';
  } else if (stage === 'procurement' && !mrf.unsignedPOUrl) {
    stages[2].status = 'current';
    return stages;
  } else if (stages[1].status === 'completed') {
    stages[2].status = 'completed';
  }

  // PO Stage
  if (mrf.unsignedPOUrl && !mrf.signedPOUrl) {
    stages[2].status = 'completed';
    stages[3].status = 'current';
    return stages;
  } else if (mrf.signedPOUrl) {
    stages[2].status = 'completed';
    stages[3].status = 'completed';
  } else if (stage === 'supply_chain') {
    stages[2].status = 'completed';
    stages[3].status = 'current';
    return stages;
  }

  // GRN Stage
  if ((mrf as any).grnSubmitted || status.includes('grn')) {
    stages[4].status = 'completed';
  } else if (stage === 'finance' && !status.includes('processing payment')) {
    stages[4].status = 'current';
    return stages;
  }

  // Payment Stage
  if (status === 'paid' || stage === 'completed') {
    stages[4].status = 'completed';
    stages[5].status = 'completed';
  } else if (status.includes('processing payment')) {
    stages[4].status = 'completed';
    stages[5].status = 'current';
  }

  return stages;
};

const getProgressPercentage = (stages: ProgressStage[]): number => {
  const completedCount = stages.filter(s => s.status === 'completed').length;
  return Math.round((completedCount / stages.length) * 100);
};

const StageIndicator = ({ stage, isLast }: { stage: ProgressStage; isLast: boolean }) => {
  const getStatusStyles = () => {
    switch (stage.status) {
      case 'completed':
        return 'bg-success text-success-foreground border-success';
      case 'current':
        return 'bg-primary text-primary-foreground border-primary animate-pulse';
      case 'rejected':
        return 'bg-destructive text-destructive-foreground border-destructive';
      default:
        return 'bg-muted text-muted-foreground border-muted-foreground/30';
    }
  };

  const getLineStyles = () => {
    switch (stage.status) {
      case 'completed':
        return 'bg-success';
      case 'current':
        return 'bg-gradient-to-r from-success to-muted';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="flex items-center flex-1">
      <div className="flex flex-col items-center">
        <div 
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
            getStatusStyles()
          )}
        >
          {stage.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : stage.status === 'rejected' ? (
            <XCircle className="h-4 w-4" />
          ) : stage.status === 'current' ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </div>
        <span className={cn(
          "text-xs mt-1 text-center max-w-[60px]",
          stage.status === 'completed' && 'text-success font-medium',
          stage.status === 'current' && 'text-primary font-medium',
          stage.status === 'rejected' && 'text-destructive font-medium',
          stage.status === 'pending' && 'text-muted-foreground'
        )}>
          {stage.shortName}
        </span>
      </div>
      {!isLast && (
        <div className={cn("h-0.5 flex-1 mx-2 rounded", getLineStyles())} />
      )}
    </div>
  );
};

export const ProcurementProgressTracker = ({ mrfRequests, showTitle = true }: ProcurementProgressTrackerProps) => {
  // Get active MRFs (not rejected or completed)
  const activeMRFs = mrfRequests.filter(mrf => {
    const stage = mrf.currentStage?.toLowerCase() || '';
    return stage !== 'completed' && stage !== 'rejected';
  }); // Don't slice here, we'll show 3 at a time with scrolling

  if (activeMRFs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Procurement Progress Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active procurement items to track</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            PFI / PO / GRN Progress Tracker
          </CardTitle>
          <CardDescription>
            Visual tracking of procurement stages for all active requests
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-y-auto max-h-[600px]">
          <div className="space-y-6">
            {activeMRFs.slice(0, 3).map((mrf) => {
          const stages = getStagesForMRF(mrf);
          const progress = getProgressPercentage(stages);
          
          return (
            <div key={mrf.id} className="space-y-3 p-4 rounded-lg border bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{mrf.id}</span>
                    {mrf.poNumber && (
                      <Badge variant="outline" className="text-xs">
                        PO: {mrf.poNumber}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium truncate">{mrf.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {mrf.requester} • {mrf.department} • ₦{parseFloat(mrf.estimatedCost).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={progress === 100 ? "default" : "secondary"}>
                    {progress}% Complete
                  </Badge>
                </div>
              </div>
              
              {/* Progress Bar */}
              <Progress value={progress} className="h-2" />
              
              {/* Stage Indicators */}
              <div className="flex items-start pt-2">
                {stages.map((stage, index) => (
                  <StageIndicator 
                    key={stage.id} 
                    stage={stage} 
                    isLast={index === stages.length - 1} 
                  />
                ))}
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
