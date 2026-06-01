import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SimpleProgressStep {
  key: string;
  label: string;
  status: string;
  completedAt?: string | null;
}

interface SimpleProgressStepperProps {
  steps: SimpleProgressStep[];
  className?: string;
}

function normalizeStatus(status: string): 'completed' | 'pending' | 'not_started' {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'pending' || s === 'in_progress' || s === 'in progress' || s === 'current') {
    return 'pending';
  }
  return 'not_started';
}

export function SimpleProgressStepper({ steps, className }: SimpleProgressStepperProps) {
  if (!steps.length) {
    return <p className="text-sm text-muted-foreground">No progress steps available.</p>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, index) => {
        const status = normalizeStatus(step.status);
        const isLast = index === steps.length - 1;
        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-0.5">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2',
                  status === 'completed' && 'bg-success text-success-foreground border-success',
                  status === 'pending' && 'bg-warning text-warning-foreground border-warning',
                  status === 'not_started' && 'bg-muted text-muted-foreground border-muted-foreground/30',
                )}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : status === 'pending' ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 mt-1 rounded min-h-[20px]',
                    status === 'completed' ? 'bg-success' : 'bg-muted',
                  )}
                />
              )}
            </div>
            <div className="flex-1 pt-0.5 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{step.label}</span>
                {status === 'pending' && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    Current
                  </Badge>
                )}
              </div>
              {status === 'completed' && step.completedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(step.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SimpleProgressStepper;
