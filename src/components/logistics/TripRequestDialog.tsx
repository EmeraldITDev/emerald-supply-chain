import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Plus } from "lucide-react";
import { canCreateTripRequest } from "@/utils/tripRequestAccess";
import { TripRequestForm } from "./TripRequestForm";
import { cn } from "@/lib/utils";

interface TripRequestDialogProps {
  userRole?: string | null;
  onCreated?: () => void;
  /** Compact trigger for app header */
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  label?: string;
  showIcon?: boolean;
}

export function TripRequestDialog({
  userRole,
  onCreated,
  variant = "outline",
  size = "default",
  className,
  label = "Trip Request",
  showIcon = true,
}: TripRequestDialogProps) {
  const [open, setOpen] = useState(false);

  if (!canCreateTripRequest(userRole)) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={cn("shrink-0", className)}>
          {showIcon && size !== "icon" && <Plus className="mr-2 h-4 w-4" />}
          {size === "icon" ? <MapPin className="h-4 w-4" /> : label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trip Request</DialogTitle>
          <DialogDescription>
            Submit a travel request for logistics review and vendor assignment.
          </DialogDescription>
        </DialogHeader>
        <TripRequestForm
          onSuccess={() => {
            setOpen(false);
            onCreated?.();
          }}
          onCancel={() => setOpen(false)}
          showCancel
        />
      </DialogContent>
    </Dialog>
  );
}
