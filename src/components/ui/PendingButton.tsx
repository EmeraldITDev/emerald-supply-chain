import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PendingButtonProps extends ButtonProps {
  /** When true, the button is disabled and shows a spinner in place of the leading icon. */
  isPending?: boolean;
  /** Optional label swap while pending (e.g. "Signing…"). Falls back to children. */
  pendingLabel?: React.ReactNode;
}

/**
 * Thin wrapper around Button that provides immediate feedback during mutations.
 * Use for any button that fires a React Query `useMutation` — wire `isPending`
 * from the mutation's `isPending` flag so the UI can't be double-clicked and the
 * user gets an instant spinner while waiting on the network.
 */
export const PendingButton = React.forwardRef<HTMLButtonElement, PendingButtonProps>(
  ({ isPending, pendingLabel, disabled, children, className, ...rest }, ref) => (
    <Button
      ref={ref}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      className={cn(className)}
      {...rest}
    >
      {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {isPending && pendingLabel ? pendingLabel : children}
    </Button>
  ),
);
PendingButton.displayName = "PendingButton";