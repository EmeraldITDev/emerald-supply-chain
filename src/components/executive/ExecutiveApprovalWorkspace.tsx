import { useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ApprovalItem } from "@/utils/executiveApprovalIntel";
import { formatValue } from "@/utils/executiveApprovalIntel";

interface Props {
  items: ApprovalItem[];
  actionable: (item: ApprovalItem) => boolean;
  busyKey: string | null;
  remarks: Record<string, string>;
  onRemarkChange: (key: string, value: string) => void;
  onApprove: (item: ApprovalItem) => void;
  onReject: (item: ApprovalItem) => void;
  onViewDetails: (item: ApprovalItem) => void;
  onOpenFull: (item: ApprovalItem) => void;
  emptyMessage?: string;
}

const priorityTone: Record<ApprovalItem["priority"], string> = {
  high: "border-l-destructive",
  medium: "border-l-amber-500",
  low: "border-l-primary/40",
};

const waitTone = (days: number) =>
  days >= 4
    ? "text-destructive"
    : days >= 2
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

export const ExecutiveApprovalWorkspace = ({
  items,
  actionable,
  busyKey,
  remarks,
  onRemarkChange,
  onApprove,
  onReject,
  onViewDetails,
  onOpenFull,
  emptyMessage = "Nothing is waiting for your decision.",
}: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <CheckCircle className="mx-auto mb-3 h-8 w-8 text-emerald-500 opacity-70" />
        <p className="text-sm font-medium">{emptyMessage}</p>
        <p className="mt-1 text-xs text-muted-foreground">You are fully caught up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const open = !!expanded[item.key];
        const busy = busyKey === item.key;
        const canAct = actionable(item);
        const remark = remarks[item.key] ?? "";

        return (
          <div
            key={item.key}
            className={cn("rounded-lg border border-l-4 bg-card", priorityTone[item.priority])}
          >
            {/* Summary row */}
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [item.key]: !open }))}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                {open ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold sm:text-base">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.typeLabel} • {item.reference} • {item.requester}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.unit} • {item.summary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={item.priority === "high" ? "destructive" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {item.priority} priority
                    </Badge>
                    {item.value != null && (
                      <Badge
                        variant={item.highValue ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {formatValue(item.value, item.currency)}
                      </Badge>
                    )}
                    <span className={cn("text-[11px] font-medium", waitTone(item.waitingDays))}>
                      Waiting {item.waitingDays} day{item.waitingDays === 1 ? "" : "s"}
                    </span>
                    {item.submitted && (
                      <span className="text-[11px] text-muted-foreground">
                        Submitted {item.submitted.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 flex-wrap gap-2">
                {canAct ? (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => onApprove(item)}>
                      {busy ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-1 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => {
                        setExpanded((p) => ({ ...p, [item.key]: true }));
                        onReject(item);
                      }}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => onOpenFull(item)}>
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Review
                  </Button>
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {open && (
              <div className="space-y-3 border-t px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                {item.mrf && (
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <Detail label="Category" value={String(item.mrf.category ?? "—")} />
                    <Detail label="Quantity" value={String(item.mrf.quantity ?? "—")} />
                    <Detail
                      label="Estimated value"
                      value={formatValue(item.value, item.currency)}
                    />
                    <Detail label="Requester" value={item.requester} />
                    <Detail
                      label="Description"
                      value={String(item.mrf.description ?? "—")}
                      full
                    />
                    <Detail
                      label="Justification"
                      value={String(item.mrf.justification ?? "—")}
                      full
                    />
                  </div>
                )}

                {item.registration && (
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <Detail label="Company" value={item.registration.companyName} />
                    <Detail label="Contact" value={item.registration.contactPerson || "—"} />
                    <Detail label="Email" value={item.registration.email || "—"} />
                    <Detail label="Phone" value={item.registration.phone || "—"} />
                  </div>
                )}

                {canAct && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Remarks (required to reject)</p>
                    <Textarea
                      value={remark}
                      onChange={(e) => onRemarkChange(item.key, e.target.value)}
                      placeholder="Add a note for the requester…"
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(item)}>
                    <Eye className="mr-1 h-4 w-4" />
                    View details
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onOpenFull(item)}>
                    <FileText className="mr-1 h-4 w-4" />
                    Open full request
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Detail = ({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) => (
  <div className={cn("min-w-0", full && "sm:col-span-2")}>
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 break-words text-xs">{value || "—"}</p>
  </div>
);
