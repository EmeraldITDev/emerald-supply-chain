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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { srfApi } from "@/services/api";
import type { SRF } from "@/types";
import { getDisplayId } from "@/utils/displayId";
import {
  formatRequesterEditTimeRemaining,
  resolveRequesterEditAccess,
} from "@/utils/requesterEditWindow";
import { useAuth } from "@/contexts/AuthContext";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { MultiFileDropzone } from "@/components/attachments/MultiFileDropzone";

interface RequesterEditSrfDialogProps {
  srf: SRF | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function RequesterEditSrfDialog({
  srf,
  open,
  onOpenChange,
  onSaved,
}: RequesterEditSrfDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    service_type: "",
    urgency: "Medium",
    duration: "",
    estimated_cost: "",
    justification: "",
  });

  const access = srf ? resolveRequesterEditAccess(srf, user) : { canEdit: false, expiresAt: null };
  const timeLeft = formatRequesterEditTimeRemaining(access.expiresAt);

  const seedForm = () => {
    if (!srf) return;
    setForm({
      title: srf.title || "",
      description: srf.description || "",
      service_type: srf.service_type || srf.serviceType || "",
      urgency: String(srf.urgency || "Medium"),
      duration: srf.duration || "",
      estimated_cost: String(srf.estimated_cost ?? srf.estimatedCost ?? ""),
      justification: srf.justification || "",
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
          <DialogTitle>Edit SRF</DialogTitle>
          <DialogDescription>
            Update this service request within 48 hours of submission.
            {srf ? ` ${getDisplayId(srf)}` : ""}
            {timeLeft ? ` · ${timeLeft}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!access.canEdit ? (
          <p className="text-sm text-destructive">{access.reason}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-srf-title">Title</Label>
              <Input
                id="edit-srf-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-srf-description">Description</Label>
              <Textarea
                id="edit-srf-description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-srf-service">Service type</Label>
              <Input
                id="edit-srf-service"
                value={form.service_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, service_type: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Urgency</Label>
                <Select
                  value={form.urgency}
                  onValueChange={(v) => setForm((p) => ({ ...p, urgency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-srf-duration">Duration</Label>
                <Input
                  id="edit-srf-duration"
                  value={form.duration}
                  onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-srf-cost">Estimated cost (₦)</Label>
              <Input
                id="edit-srf-cost"
                type="number"
                value={form.estimated_cost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, estimated_cost: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-srf-justification">Justification</Label>
              <Textarea
                id="edit-srf-justification"
                value={form.justification}
                onChange={(e) =>
                  setForm((p) => ({ ...p, justification: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 border-t pt-4">
              <AttachmentList
                attachments={srf?.attachments ?? srf?.documents}
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
            disabled={!access.canEdit || saving || !srf}
            onClick={async () => {
              if (!srf) return;
              setSaving(true);
              try {
                const payload = {
                  title: form.title,
                  description: form.description,
                  service_type: form.service_type,
                  urgency: form.urgency as SRF["urgency"],
                  duration: form.duration,
                  estimated_cost: form.estimated_cost || null,
                  justification: form.justification,
                };
                let res;
                if (attachmentFiles.length > 0) {
                  const formData = new FormData();
                  Object.entries(payload).forEach(([key, value]) => {
                    if (value !== null) formData.append(key, String(value));
                  });
                  attachmentFiles.forEach((file) => formData.append("attachments[]", file, file.name));
                  res = await srfApi.updateWithAttachments(srf.id, formData);
                } else {
                  res = await srfApi.update(srf.id, payload);
                }
                if (res.success) {
                  toast({
                    title: "SRF updated",
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
