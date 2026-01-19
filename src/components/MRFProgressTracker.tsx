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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mrfApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface MRFProgressTrackerProps {
  mrfId: string;
  showTitle?: boolean;
  onProgressUpdate?: (progress: number) => void;
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

const stepIcons: Record<number, React.ReactNode> = {
  1: <FileText className="h-4 w-4" />,
  2: <CheckCircle2 className="h-4 w-4" />,
  3: <FileText className="h-4 w-4" />,
  4: <CheckCircle2 className="h-4 w-4" />,
  5: <Package className="h-4 w-4" />,
  6: <DollarSign className="h-4 w-4" />,
  7: <Truck className="h-4 w-4" />,
  8: <CheckCircle2 className="h-4 w-4" />,
};

const stepNames: Record<number, string> = {
  1: "MRF Created",
  2: "Executive Approval",
  3: "RFQ Issued",
  4: "Supply Chain Director Approval",
  5: "Procurement Generates PO",
  6: "Finance Review & Processing",
  7: "Goods Received Note (GRN)",
  8: "Mark as Paid / Closed",
};

export const MRFProgressTracker = ({ mrfId, showTitle = true, onProgressUpdate }: MRFProgressTrackerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<{
    mrfId: string;
    title: string;
    currentStep: number;
    steps: ProgressStep[];
  } | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!mrfId) return;
      
      setLoading(true);
      try {
        const response = await mrfApi.getProgressTracker(mrfId);
        if (response.success && response.data) {
          setProgressData(response.data);
          
          // Calculate progress percentage
          const completedCount = response.data.steps.filter(s => s.status === 'completed').length;
          const progress = Math.round((completedCount / response.data.steps.length) * 100);
          onProgressUpdate?.(progress);
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
  }, [mrfId, toast, onProgressUpdate]);

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

  const completedCount = progressData.steps.filter(s => s.status === 'completed').length;
  const progressPercentage = Math.round((completedCount / progressData.steps.length) * 100);

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
            Progress Tracker
          </CardTitle>
          <CardDescription>{progressData.title}</CardDescription>
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
            {progressData.steps.map((step, index) => {
              const isLast = index === progressData.steps.length - 1;
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
                      <span className="font-medium">{step.name}</span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    {step.status === 'completed' && step.completedAt && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          Completed: {new Date(step.completedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {step.completedBy && (
                          <p>By: {step.completedBy.name}</p>
                        )}
                        {step.remarks && (
                          <p className="italic mt-1">"{step.remarks}"</p>
                        )}
                      </div>
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
