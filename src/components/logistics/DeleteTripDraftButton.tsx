import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripRequestApi } from "@/services/api";
import type { StaffTripRequest } from "@/types/trip-request";
import { tripCanDeleteDraft, tripDeleteDraftAction } from "@/utils/tripDraftUi";

interface DeleteTripDraftButtonProps {
  trip: StaffTripRequest;
  onDeleted?: () => void;
  variant?: "outline" | "destructive" | "ghost";
  size?: "sm" | "default";
  className?: string;
  stopPropagation?: boolean;
}

export function DeleteTripDraftButton({
  trip,
  onDeleted,
  variant = "outline",
  size = "sm",
  className,
  stopPropagation = false,
}: DeleteTripDraftButtonProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const action = tripDeleteDraftAction(trip);
  if (!tripCanDeleteDraft(trip) || !action?.path) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await tripRequestApi.delete(action.path);
      if (res.success) {
        toast({
          title: "Draft deleted",
          description: res.data?.message ?? "Trip request removed.",
        });
        setOpen(false);
        onDeleted?.();
      } else {
        toast({
          title: "Could not delete",
          description: res.error || "Delete failed",
          variant: "destructive",
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          {action.label ?? "Delete draft"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => stopPropagation && e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete draft trip request?</AlertDialogTitle>
          <AlertDialogDescription>
            {action.confirmMessage ??
              "Are you sure you want to delete this draft trip request? This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteTripDraftButton;
