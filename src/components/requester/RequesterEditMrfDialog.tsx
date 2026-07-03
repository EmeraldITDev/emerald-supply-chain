import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import { getDisplayId } from "@/utils/displayId";
import {
  formatRequesterEditTimeRemaining,
  resolveRequesterEditAccess,
} from "@/utils/requesterEditWindow";
import { useAuth } from "@/contexts/AuthContext";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { MultiFileDropzone } from "@/components/attachments/MultiFileDropzone";

interface RequesterEditMrfDialogProps {
  mrf: MRF | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function RequesterEditMrfDialog({
  mrf,
  open,
  onOpenChange,
  onSaved,
}: RequesterEditMrfDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    quantity: "",
    estimated_cost: "",
    justification: "",
    category: "",
  });

  const access = mrf ? resolveRequesterEditAccess(mrf, user) : { canEdit: false, expiresAt: null };
  const timeLeft = formatRequesterEditTimeRemaining(access.expiresAt);

  const seedForm = () => {
    if (!mrf) return;
    setForm({
      title: mrf.title || "",
      description: mrf.description || "",
      quantity: String(mrf.quantity ?? ""),
      estimated_cost: String(mrf.estimated_cost ?? mrf.estimatedCost ?? ""),
      justification: mrf.justification || "",
      category: mrf.category || "",
    });
    setAttachmentFiles([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) seedForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit MRF</DialogTitle>
          <DialogDescription>
            Update this request within 48 hours of submission. Changes appear for
            Procurement, Supply Chain, and Executive reviewers.
            {mrf ? ` ${getDisplayId(mrf)}` : ""}
            {timeLeft ? ` · ${timeLeft}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!access.canEdit ? (
          <p className="text-sm text-destructive">{access.reason}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-mrf-title">Title</Label>
              <Input
                id="edit-mrf-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-mrf-description">Description</Label>
              <Textarea
                id="edit-mrf-description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-mrf-qty">Quantity</Label>
                <Input
                  id="edit-mrf-qty"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-mrf-cost">Estimated cost (₦)</Label>
                <Input
                  id="edit-mrf-cost"
                  type="number"
                  value={form.estimated_cost}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, estimated_cost: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-mrf-category">Category</Label>
              <Input
                id="edit-mrf-category"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-mrf-justification">Justification</Label>
              <Textarea
                id="edit-mrf-justification"
                value={form.justification}
                onChange={(e) =>
                  setForm((p) => ({ ...p, justification: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 border-t pt-4">
              <AttachmentList
                attachments={mrf?.attachments ?? mrf?.documents}
                title="Existing Documents"
              />
              <MultiFileDropzone
                files={attachmentFiles}
                onFilesChange={setAttachmentFiles}
                disabled={saving}
                label="Add supporting documents"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!access.canEdit || saving || !mrf}
            onClick={async () => {
              if (!mrf) return;
              setSaving(true);
              try {
                const payload = {
                  title: form.title,
                  description: form.description,
                  quantity: form.quantity,
                  estimated_cost: form.estimated_cost,
                  justification: form.justification,
                  category: form.category,
                };
                let res;
                if (attachmentFiles.length > 0) {
                  const formData = new FormData();
                  Object.entries(payload).forEach(([key, value]) => formData.append(key, String(value)));
                  attachmentFiles.forEach((file) => formData.append("attachments[]", file, file.name));
                  res = await mrfApi.updateWithAttachments(mrf.id, formData);
                } else {
                  res = await mrfApi.update(mrf.id, payload);
                }
                if (res.success) {
                  toast({
                    title: "MRF updated",
                    description:
                      "Your changes were saved. Reviewers will see the updated request.",
                  });
                  onOpenChange(false);
                  window.dispatchEvent(new Event("app:refresh"));
                  onSaved?.();
                } else {
                  toast({
                    title: "Could not save changes",
                    description: res.error || "Update was not allowed.",
                    variant: "destructive",
                  });
                }
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
