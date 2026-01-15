import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { mrfApi } from "@/services/api";
import type { MRF, AvailableActions } from "@/types";

interface ExecutiveActionButtonsProps {
  mrf: MRF;
  onApprove: (mrfId: string) => void;
  onReject: (mrfId: string) => void;
  comments: string;
  onCommentsChange: (value: string) => void;
  isLoading?: boolean;
}

export const ExecutiveActionButtons: React.FC<ExecutiveActionButtonsProps> = ({
  mrf,
  onApprove,
  onReject,
  comments,
  onCommentsChange,
  isLoading = false,
}) => {
  const [availableActions, setAvailableActions] = useState<AvailableActions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        setLoading(true);
        const response = await mrfApi.getAvailableActions(mrf.id);
        if (response.success && response.data) {
          setAvailableActions(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch available actions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [mrf.id]);

  // Don't show anything if loading or no actions available
  if (loading || !availableActions) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Never show approve/reject if not available
  if (!availableActions.canApprove && !availableActions.canReject) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Comments / Remarks:</label>
      <Textarea
        value={comments}
        onChange={(e) => onCommentsChange(e.target.value)}
        placeholder="Enter your comments or approval remarks..."
        rows={3}
        disabled={isLoading}
      />
      <div className="flex gap-2">
        {availableActions.canApprove && (
          <Button
            onClick={() => onApprove(mrf.id)}
            className="flex-1"
            variant="default"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Confirm Approval
          </Button>
        )}
        {availableActions.canReject && (
          <Button
            onClick={() => onReject(mrf.id)}
            variant="destructive"
            className="flex-1"
            disabled={isLoading || !comments.trim()}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Reject MRF
          </Button>
        )}
      </div>
    </div>
  );
};
