import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { mrfApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface MrfBulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
}

export function MrfBulkActionsBar({
  selectedIds,
  onClear,
  onDone,
}: MrfBulkActionsBarProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (selectedIds.length === 0) return null;

  const runApprove = async () => {
    setBusy(true);
    try {
      const res = await mrfApi.bulkApprove(selectedIds);
      const succeeded = res.data?.succeeded?.length ?? 0;
      const failed = res.data?.failed?.length ?? 0;
      toast({
        title: res.success ? "Bulk approve complete" : "Bulk approve finished with errors",
        description: `${succeeded} succeeded, ${failed} failed`,
        variant: failed && !succeeded ? "destructive" : "default",
      });
      if (failed > 0 && res.data?.failed) {
        console.warn("[bulk-approve] failures", res.data.failed);
      }
      onClear();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const runReject = async () => {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast({
        title: "Reason required",
        description: "Provide a rejection reason for the selected MRFs.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await mrfApi.bulkReject(selectedIds, reason);
      const succeeded = res.data?.succeeded?.length ?? 0;
      const failed = res.data?.failed?.length ?? 0;
      toast({
        title: res.success ? "Bulk reject complete" : "Bulk reject finished with errors",
        description: `${succeeded} succeeded, ${failed} failed`,
        variant: failed && !succeeded ? "destructive" : "default",
      });
      setRejectOpen(false);
      setRejectReason("");
      onClear();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const runExport = async () => {
    setBusy(true);
    try {
      const res = await mrfApi.bulkExport(selectedIds, "json");
      if (!res.success || !res.data) {
        toast({
          title: "Export failed",
          description: res.error || "Could not export selected MRFs",
          variant: "destructive",
        });
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mrf-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: `${res.data.length} MRF(s) exported` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <span className="text-sm font-medium mr-2">{selectedIds.length} selected</span>
        <Button size="sm" onClick={() => void runApprove()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Bulk Approve
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Bulk Reject
        </Button>
        <Button size="sm" variant="outline" onClick={() => void runExport()} disabled={busy}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Bulk Export
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
          Clear
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk reject MRFs</DialogTitle>
            <DialogDescription>
              Uses the same permission and stage rules as individual reject. Provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-reject-reason">Reason</Label>
            <Textarea
              id="bulk-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void runReject()} disabled={busy}>
              Reject {selectedIds.length} MRF(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Checkbox helper for list rows — stops row click from opening the detail. */
export function MrfSelectCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div
      className="pt-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-label="Select MRF"
      />
    </div>
  );
}
