import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Plus, X, Download, Printer, FileCheck2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { materialsMovementsApi } from "@/services/logisticsApi";
import type { MaterialMovementRecord, MaterialJCC, MaterialJCCLineItem, ConditionOnArrival } from "@/types/logistics";
import {
  formatJCCStatus,
  jccStatusBadgeClass,
  canManageMovementsRole,
  canApproveMaterialJCCRole,
} from "@/utils/materialStatus";
import { cn } from "@/lib/utils";

interface Props {
  movement: MaterialMovementRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
  pdfEndpointAvailable?: boolean; // pre-flight #5
}

const DEFAULT_CERT =
  "This is to certify that the above-named vendor duly completed the transportation/delivery of goods for Emerald Industrial as detailed below.";

const blankJCC = (movement: MaterialMovementRecord, signatory: { name: string; title: string }): MaterialJCC => ({
  materialId: movement.id,
  referenceNumber: undefined,
  dateIssued: new Date().toISOString().slice(0, 10),
  certificationStatement: DEFAULT_CERT,
  conditionOnArrival: "",
  lineItems: [],
  status: "draft",
  signatoryName: signatory.name,
  signatoryTitle: signatory.title,
  vendorName: movement.vendorName ?? undefined,
  vendorAddress: movement.vendorAddress ?? undefined,
  linkedPoNumber: movement.linkedPoNumber ?? null,
});

export const MaterialJCCDialog = ({ movement, open, onOpenChange, onApproved, pdfEndpointAvailable = true }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = (user as any)?.role as string | undefined;
  const signatory = {
    name: user?.name ?? "",
    title: (user as any)?.title ?? (user as any)?.role ?? "",
  };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jcc, setJcc] = useState<MaterialJCC | null>(null);
  const [prefillPromptOpen, setPrefillPromptOpen] = useState(false);
  const [prefillItems, setPrefillItems] = useState<MaterialJCCLineItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canManage = canManageMovementsRole(role);
  const canApprove = canApproveMaterialJCCRole(role);
  const isDraftEditable = (jcc?.status ?? "draft") === "draft" && canManage;
  const isPendingApproval = jcc?.status === "submitted";
  const showApprove = isPendingApproval && canApprove;
  const readOnly = !isDraftEditable && !showApprove;

  const loadJCC = useCallback(async () => {
    if (!movement) return;
    setLoading(true);
    try {
      const res = await materialsMovementsApi.getJCC(movement.id);
      let loaded: MaterialJCC;
      if (res.success && res.data) {
        loaded = {
          ...res.data,
          materialId: movement.id,
          vendorName: res.data.vendorName ?? movement.vendorName ?? undefined,
          vendorAddress: res.data.vendorAddress ?? movement.vendorAddress ?? undefined,
          linkedPoNumber: res.data.linkedPoNumber ?? movement.linkedPoNumber ?? null,
          signatoryName: res.data.signatoryName ?? signatory.name,
          signatoryTitle: res.data.signatoryTitle ?? signatory.title,
        };
      } else {
        loaded = blankJCC(movement, signatory);
      }
      setJcc(loaded);

      // Conditional prefill (skip for submitted/approved)
      const isDraft = loaded.status === "draft";
      const noLineItems = loaded.lineItems.length === 0;
      if (isDraft && noLineItems) {
        const pr = await materialsMovementsApi.getJCCPrefill(movement.id);
        if (pr.success && pr.data && pr.data.length > 0) {
          setPrefillItems(
            pr.data.map((it, i) => ({
              sn: i + 1,
              materialName: it.materialName,
              quantity: it.quantity,
              condition: it.condition,
              remarks: it.remarks,
            }))
          );
          setPrefillPromptOpen(true);
        }
      }
    } catch (e: any) {
      toast({ title: "Error loading JCC", description: e?.message ?? "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movement?.id]);

  useEffect(() => {
    if (open && movement) loadJCC();
    if (!open) {
      setJcc(null);
      setPrefillItems([]);
      setPrefillPromptOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, movement?.id]);

  const acceptPrefill = () => {
    setJcc(prev => (prev ? { ...prev, lineItems: prefillItems } : prev));
    setPrefillPromptOpen(false);
  };

  const updateField = <K extends keyof MaterialJCC>(key: K, value: MaterialJCC[K]) => {
    setJcc(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const addRow = () => {
    setJcc(prev =>
      prev
        ? {
            ...prev,
            lineItems: [
              ...prev.lineItems,
              { sn: prev.lineItems.length + 1, materialName: "", quantity: "", condition: "", remarks: "" },
            ],
          }
        : prev
    );
  };

  const removeRow = (idx: number) => {
    setJcc(prev =>
      prev
        ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx).map((li, i) => ({ ...li, sn: i + 1 })) }
        : prev
    );
  };

  const updateRow = (idx: number, key: keyof MaterialJCCLineItem, value: any) => {
    setJcc(prev =>
      prev
        ? { ...prev, lineItems: prev.lineItems.map((li, i) => (i === idx ? { ...li, [key]: value } : li)) }
        : prev
    );
  };

  const submitDisabled =
    !jcc ||
    !jcc.conditionOnArrival ||
    jcc.lineItems.length === 0 ||
    !jcc.certificationStatement.trim() ||
    jcc.lineItems.some(li => !li.materialName || !String(li.quantity).trim() || !li.condition || !li.remarks);

  const handleSaveDraft = async () => {
    if (!movement || !jcc) return;
    setSaving(true);
    try {
      const res = jcc.referenceNumber || jcc.id
        ? await materialsMovementsApi.updateJCC(movement.id, jcc)
        : await materialsMovementsApi.createJCC(movement.id, jcc);
      if (res.success && res.data) {
        setJcc(prev => (prev ? { ...prev, ...res.data } : res.data));
        toast({ title: "Draft saved", description: `Reference: ${res.data.referenceNumber ?? "—"}` });
      } else {
        toast({ title: "Save failed", description: res.error ?? "Try again", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!movement || !jcc) return;
    setSaving(true);
    try {
      // Persist any unsaved changes first
      const persisted = jcc.referenceNumber || jcc.id
        ? await materialsMovementsApi.updateJCC(movement.id, jcc)
        : await materialsMovementsApi.createJCC(movement.id, jcc);
      if (!persisted.success) {
        toast({ title: "Save failed", description: persisted.error ?? "Try again", variant: "destructive" });
        return;
      }
      const res = await materialsMovementsApi.submitJCC(movement.id);
      if (res.success && res.data) {
        setJcc(res.data);
        toast({ title: "JCC submitted", description: "Awaiting Supply Chain Director approval." });
      } else {
        toast({ title: "Submit failed", description: res.error ?? "Try again", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!movement) return;
    setSaving(true);
    try {
      const res = await materialsMovementsApi.approveJCC(movement.id);
      if (res.success && res.data) {
        setJcc(res.data);
        toast({ title: "JCC approved", description: "Movement may now be marked delivered." });
        onApproved?.();
      } else {
        toast({ title: "Approve failed", description: res.error ?? "Try again", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!movement) return;
    const blob = await materialsMovementsApi.downloadJCCPdf(movement.id);
    if (!blob) {
      toast({ title: "PDF unavailable", description: "Try again later.", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handlePreview = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 200);
  };

  const downloadDisabled = !pdfEndpointAvailable || jcc?.status !== "approved";

  if (!movement) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileCheck2 className="h-5 w-5" />
              Job Completion Certificate
              {jcc?.status && (
                <Badge variant="outline" className={cn(jccStatusBadgeClass(jcc.status))}>
                  {formatJCCStatus(jcc.status)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading || !jcc ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header info */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-md border bg-muted/30 p-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">JCC Reference</p>
                  <p className="font-mono text-sm">
                    {jcc.referenceNumber ?? "—"}
                  </p>
                  {!jcc.referenceNumber && (
                    <p className="text-xs text-muted-foreground">Generated when you save.</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Date Issued</Label>
                  <Input
                    type="date"
                    value={jcc.dateIssued?.slice(0, 10) ?? ""}
                    onChange={e => updateField("dateIssued", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase text-muted-foreground">Vendor</p>
                  <p className="text-sm font-medium">{jcc.vendorName || "—"}</p>
                  {jcc.vendorAddress && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{jcc.vendorAddress}</p>
                  )}
                </div>
                {jcc.linkedPoNumber && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Linked PO</p>
                    <p className="font-mono text-sm">{jcc.linkedPoNumber}</p>
                  </div>
                )}
              </div>

              {/* Certification */}
              <div className="space-y-2">
                <Label>Certification Statement</Label>
                <Textarea
                  rows={3}
                  value={jcc.certificationStatement}
                  onChange={e => updateField("certificationStatement", e.target.value)}
                  disabled={readOnly}
                />
              </div>

              {/* Condition on arrival */}
              <div className="space-y-2 max-w-sm">
                <Label>Condition on Arrival *</Label>
                <Select
                  value={jcc.conditionOnArrival || ""}
                  onValueChange={v => updateField("conditionOnArrival", v as ConditionOnArrival)}
                  disabled={readOnly}
                >
                  <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                    <SelectItem value="PARTIAL">Partial Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items *</Label>
                  {!readOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={addRow}>
                      <Plus className="mr-2 h-4 w-4" /> Add Row
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">SN</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="w-32">Condition</TableHead>
                        <TableHead>Remarks</TableHead>
                        {!readOnly && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jcc.lineItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={readOnly ? 5 : 6} className="text-center text-muted-foreground py-6">
                            No line items. {!readOnly && "Click \"Add Row\" to begin."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        jcc.lineItems.map((li, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{li.sn}</TableCell>
                            <TableCell>
                              <Input value={li.materialName} disabled={readOnly}
                                onChange={e => updateRow(idx, "materialName", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={1} value={li.quantity} disabled={readOnly}
                                onChange={e => updateRow(idx, "quantity", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input value={li.condition} disabled={readOnly}
                                onChange={e => updateRow(idx, "condition", e.target.value)} />
                            </TableCell>
                            <TableCell>
                              <Input value={li.remarks} disabled={readOnly}
                                onChange={e => updateRow(idx, "remarks", e.target.value)} />
                            </TableCell>
                            {!readOnly && (
                              <TableCell>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Signatory */}
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Signatory</p>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-medium">{jcc.signatoryName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{jcc.signatoryTitle || "—"}</p>
                  </div>
                  {jcc.signatureUrl ? (
                    <img src={jcc.signatureUrl} alt="Signature" className="h-12 object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Signature will be applied on approval.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {isDraftEditable && (
              <>
                <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save as Draft
                </Button>
                <Button onClick={handleSubmit} disabled={saving || submitDisabled}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit JCC
                </Button>
              </>
            )}
            {showApprove && (
              <Button onClick={handleApprove} disabled={saving} className="bg-success text-success-foreground">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Approve JCC
              </Button>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" onClick={handleDownload} disabled={downloadDisabled}>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </span>
                </TooltipTrigger>
                {downloadDisabled && (
                  <TooltipContent>
                    {!pdfEndpointAvailable
                      ? "PDF download will be available once backend rendering is enabled."
                      : "PDF available after JCC approval."}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" onClick={handlePreview} disabled={!jcc}>
              <Printer className="mr-2 h-4 w-4" />
              Preview Draft
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={prefillPromptOpen} onOpenChange={setPrefillPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pre-fill line items?</AlertDialogTitle>
            <AlertDialogDescription>
              Pre-fill line items from material movement details?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={acceptPrefill}>Yes, pre-fill</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print preview surface — hidden on screen, visible on print */}
      {previewOpen && jcc && (
        <div className="jcc-print-surface fixed inset-0 z-[100] bg-white p-10 overflow-auto">
          <style>{`
            @media screen { .jcc-print-surface { display: block; } }
            @media print {
              body * { visibility: hidden; }
              .jcc-print-surface, .jcc-print-surface * { visibility: visible; }
              .jcc-print-surface { position: absolute; inset: 0; padding: 24px; }
            }
            .jcc-watermark {
              position: fixed; inset: 0; pointer-events: none; z-index: 50;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
              gap: 30vh;
            }
            .jcc-watermark span {
              transform: rotate(-30deg); font-weight: 800; font-size: 96px;
              color: hsl(var(--destructive) / 0.18); white-space: nowrap;
              letter-spacing: 0.05em;
            }
            @media print { .jcc-watermark span { color: rgba(220, 38, 38, 0.18); } }
          `}</style>
          <div className="jcc-watermark">
            <span>DRAFT PREVIEW — NOT OFFICIAL CERTIFICATE</span>
            <span>DRAFT PREVIEW — NOT OFFICIAL CERTIFICATE</span>
          </div>
          <div className="max-w-3xl mx-auto text-black">
            <div className="text-center border-b pb-4 mb-6">
              <h1 className="text-2xl font-bold">EMERALD INDUSTRIAL</h1>
              <p className="text-sm">Job Completion Certificate</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div><strong>Reference:</strong> {jcc.referenceNumber ?? "—"}</div>
              <div><strong>Date:</strong> {jcc.dateIssued}</div>
              <div className="col-span-2">
                <strong>Vendor:</strong> {jcc.vendorName ?? "—"}
                {jcc.vendorAddress && <div className="text-xs">{jcc.vendorAddress}</div>}
              </div>
              {jcc.linkedPoNumber && <div><strong>PO:</strong> {jcc.linkedPoNumber}</div>}
            </div>
            <p className="mb-4 text-sm">{jcc.certificationStatement}</p>
            <p className="mb-4 text-sm"><strong>Condition on Arrival:</strong> {jcc.conditionOnArrival || "—"}</p>
            <table className="w-full border text-sm mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">SN</th>
                  <th className="border px-2 py-1">Material</th>
                  <th className="border px-2 py-1">Qty</th>
                  <th className="border px-2 py-1">Condition</th>
                  <th className="border px-2 py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {jcc.lineItems.map(li => (
                  <tr key={li.sn}>
                    <td className="border px-2 py-1">{li.sn}</td>
                    <td className="border px-2 py-1">{li.materialName}</td>
                    <td className="border px-2 py-1">{li.quantity}</td>
                    <td className="border px-2 py-1">{li.condition}</td>
                    <td className="border px-2 py-1">{li.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-12">
              <div className="border-t inline-block pt-2 min-w-[240px]">
                <p className="font-medium">{jcc.signatoryName ?? "—"}</p>
                <p className="text-xs">{jcc.signatoryTitle ?? "—"}</p>
              </div>
            </div>
            <div className="mt-8 text-center print:hidden">
              <Button onClick={() => setPreviewOpen(false)} variant="outline">Close Preview</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaterialJCCDialog;
