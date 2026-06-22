import { useEffect, useRef, useState } from "react";
import { getDisplayId } from "@/utils/displayId";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, FileText, Eye, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { grnApi, mrfApi, vendorApi } from "@/services/api";
import { procurementApi } from "@/services/procurementApi";
import { type AvailableActions, type MRF, type Vendor } from "@/types";
import type { PriceComparisonEntry } from "@/types/procurement";
import { getMrfApiId } from "@/utils/displayId";
import { describeGrnUnavailable } from "@/utils/grnEligibility";
import { getScmRole } from "@/utils/scmRole";
import { resolveSelectedSupplier } from "@/utils/emeraldPoDocumentModel";
import type { GRNLineItemOverride } from "@/types/procurement-documents";
import { openGrnPdfFromDialogState } from "@/utils/grnPdfActions";

interface GRNCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrf: MRF;
  onSuccess?: () => void;
}

export default function GRNCompletionDialog({
  open,
  onOpenChange,
  mrf,
  onSuccess,
}: GRNCompletionDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const scmRole = getScmRole(user);
  const isLogisticsGrnRole =
    scmRole === "logistics_manager" ||
    scmRole === "logistics" ||
    scmRole === "logistics_officer";
  const [isCompleting, setIsCompleting] = useState(false);
  const [grnFile, setGrnFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2 — generate-from-line-items state
  const [actions, setActions] = useState<AvailableActions | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [tab, setTab] = useState<"generate" | "upload">("generate");
  const [grnNumber, setGrnNumber] = useState("");
  const [comments, setComments] = useState("");
  const [dateOfReceipt, setDateOfReceipt] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [driverNumber, setDriverNumber] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [qtyOverrides, setQtyOverrides] = useState<Record<number, string>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewingLocal, setIsPreviewingLocal] = useState(false);

  // Enriched data for the local GRN PDF (line items + supplier come from the
  // price comparison, same source the PO uses).
  const [enrichedMrf, setEnrichedMrf] = useState<MRF>(mrf);
  const [priceComparisonRows, setPriceComparisonRows] = useState<PriceComparisonEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const effectiveMrf = enrichedMrf ?? mrf;
  const embeddedItems = (effectiveMrf.items ?? []) as Array<{
    itemName: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    unit_price?: number;
  }>;
  // Fall back to price-comparison rows (selected supplier) when the MRF has no
  // embedded line items — matches what the PO and GRN PDF render.
  const mrfItems =
    embeddedItems.length > 0
      ? embeddedItems
      : (priceComparisonRows.length > 0
          ? resolveSelectedSupplier(priceComparisonRows, vendors).supplierRows
          : []
        ).map((r) => ({
          itemName: r.item_description || effectiveMrf.title || "Item",
          quantity: Number(r.quantity) || 0,
          unit: undefined as string | undefined,
          unitPrice: Number(r.unit_price) || 0,
        }));

  const mrfPathId = getMrfApiId(mrf) || String(mrf.id ?? "");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEnrichedMrf(mrf);
    (async () => {
      setActionsLoading(true);
      try {
        const res = await mrfApi.getAvailableActions(mrfPathId);
        if (!cancelled && res.success && res.data) {
          setActions(res.data);
          // Prefer generate tab if available, otherwise fall back to upload.
          if (res.data.canGenerateGRN) setTab("generate");
          else if (res.data.canUploadGRN) setTab("upload");
        }
      } finally {
        if (!cancelled) setActionsLoading(false);
      }
    })();

    // Enrich for the local PDF: full MRF (line items/currency), price comparison
    // (selected supplier + line items), and the vendor directory.
    (async () => {
      try {
        const [fullRes, pcRes, vendorsRes] = await Promise.all([
          mrfApi.getById(mrfPathId),
          procurementApi.getPriceComparison(mrfPathId),
          vendorApi.getAll(),
        ]);
        if (cancelled) return;
        if (fullRes.success && fullRes.data) {
          setEnrichedMrf((prev) => ({ ...prev, ...fullRes.data }));
        }
        if (pcRes.success && Array.isArray(pcRes.data)) {
          setPriceComparisonRows(pcRes.data);
        }
        if (vendorsRes.success && Array.isArray(vendorsRes.data)) {
          setVendors(vendorsRes.data);
        }
      } catch {
        // Non-fatal — local preview still renders header/comment fields.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mrfPathId, mrf]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF, DOC, or DOCX file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setGrnFile(file);
    }
  };

  const handleCompleteGRN = async () => {
    if (!grnFile) {
      toast({
        title: "File Required",
        description: "Please select a GRN file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    try {
      const response = await grnApi.completeGRN(mrf.id, grnFile);
      
      if (response.success) {
        toast({
          title: "GRN Completed Successfully",
          description: `GRN for PO ${mrf.po_number || mrf.po_number} has been completed and uploaded.`,
        });
        setGrnFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to complete GRN",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while completing GRN.",
        variant: "destructive",
      });
      console.error("GRN completion error:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  const buildGrnParams = () => {
    const lineItems: GRNLineItemOverride[] = Object.entries(qtyOverrides)
      .map(([idx, raw]) => {
        const n = Number(raw);
        if (!Number.isFinite(n) || raw === "") return null;
        return { index: Number(idx), quantityReceived: n };
      })
      .filter((v): v is GRNLineItemOverride => v !== null);
    return {
      grnNumber: grnNumber || undefined,
      dateOfReceipt: dateOfReceipt || undefined,
      deliveryNoteNumber: deliveryNoteNumber || undefined,
      deliveryDate: deliveryDate || undefined,
      carrierName: carrierName || undefined,
      driverNumber: driverNumber || undefined,
      vehiclePlateNumber: vehiclePlateNumber || undefined,
      comments: comments || undefined,
      lineItems: lineItems.length ? lineItems : undefined,
    };
  };

  const handlePreviewGRN = async () => {
    setIsPreviewing(true);
    try {
      const res = await procurementApi.previewGRN(mrfPathId, buildGrnParams());
      if (res.success && res.data) {
        window.open(res.data.objectUrl, "_blank", "noopener,noreferrer");
      } else {
        const isPermissionDenied =
          res.status === 403 ||
          /permission/i.test(res.error || "");
        toast({
          title: "Preview Failed",
          description: isPermissionDenied
            ? isLogisticsGrnRole
              ? "Server preview is not enabled for your role yet. Use Preview locally to review the PDF, then Confirm & Generate to save."
              : res.error || "You do not have permission to preview GRN for this MRF."
            : res.error || "Unable to generate GRN preview.",
          variant: "destructive",
        });
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePreviewLocal = async () => {
    setIsPreviewingLocal(true);
    try {
      const mrfAny = effectiveMrf as unknown as {
        vendor_name?: string;
        vendorName?: string;
        vendor_address?: string;
        vendorAddress?: string;
      };
      await openGrnPdfFromDialogState({
        mrf: effectiveMrf,
        grnNumber,
        dateOfReceipt,
        deliveryNoteNumber,
        deliveryDate,
        carrierName,
        driverName: carrierName,
        driverPhone: driverNumber,
        vehiclePlateNumber,
        comments,
        quantityReceivedOverrides: qtyOverrides,
        supplierName: mrfAny.vendor_name || mrfAny.vendorName,
        supplierAddress: mrfAny.vendor_address || mrfAny.vendorAddress,
        priceComparisonRows,
        vendors,
      });
    } catch (e) {
      toast({
        title: "Local preview failed",
        description: e instanceof Error ? e.message : "Could not render GRN preview.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewingLocal(false);
    }
  };

  const handleGenerateGRN = async () => {
    setIsGenerating(true);
    try {
      const res = await procurementApi.generateGRN(mrfPathId, {
        confirm: true,
        ...buildGrnParams(),
      });
      if (res.success) {
        toast({
          title: "GRN Generated",
          description: `GRN saved to the document registry for MRF ${getDisplayId(mrf)}.`,
        });
        setGrnNumber("");
        setComments("");
        setQtyOverrides({});
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Generation Failed",
          description: res.error || "Unable to generate GRN.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = actions?.canGenerateGRN ?? false;
  const canUpload = actions?.canUploadGRN ?? false;
  const showServerPreview = canGenerate && !isLogisticsGrnRole;
  const grnBlocked = describeGrnUnavailable(mrf, actions);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Goods Received Note (GRN)</DialogTitle>
          <DialogDescription>
            Generate a GRN from this MRF&apos;s line items or upload an existing
            GRN document for PO {mrf.po_number || "—"} (MRF {getDisplayId(mrf)}).
          </DialogDescription>
        </DialogHeader>

        {actionsLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading available actions…
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "generate" | "upload")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generate" disabled={!canGenerate}>
                Generate from line items
              </TabsTrigger>
              <TabsTrigger value="upload" disabled={!canUpload}>
                Upload existing file
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4 pt-4">
              {!canGenerate ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">{grnBlocked.title}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                      {grnBlocked.details.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
              <>
              <Alert>
                <FileCheck className="h-4 w-4" />
                <AlertDescription>
                  {isLogisticsGrnRole
                    ? "Preview the GRN locally, then confirm to save it to the document registry."
                    : "Preview the auto-generated GRN PDF, then confirm to save it to the document registry."}
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grn-number">GRN Number (optional)</Label>
                  <Input
                    id="grn-number"
                    value={grnNumber}
                    onChange={(e) => setGrnNumber(e.target.value)}
                    placeholder="Auto-generated if blank"
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-of-receipt">Date of Receipt</Label>
                  <Input
                    id="date-of-receipt"
                    type="date"
                    value={dateOfReceipt}
                    onChange={(e) => setDateOfReceipt(e.target.value)}
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-note-number">Delivery Note #</Label>
                  <Input
                    id="delivery-note-number"
                    value={deliveryNoteNumber}
                    onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                    placeholder="N/A"
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-date">Delivery Date</Label>
                  <Input
                    id="delivery-date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carrier-name">Carrier / Driver Name</Label>
                  <Input
                    id="carrier-name"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    placeholder="N/A"
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driver-number">Driver Phone</Label>
                  <Input
                    id="driver-number"
                    value={driverNumber}
                    onChange={(e) => setDriverNumber(e.target.value)}
                    placeholder="N/A"
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="vehicle-plate">Vehicle Plate #</Label>
                  <Input
                    id="vehicle-plate"
                    value={vehiclePlateNumber}
                    onChange={(e) => setVehiclePlateNumber(e.target.value)}
                    placeholder="N/A"
                    disabled={isGenerating || isPreviewing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="e.g. Received in good condition"
                  rows={3}
                  disabled={isGenerating || isPreviewing}
                />
              </div>

              {mrfItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Quantities Received</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the original ordered quantity.
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left min-w-[180px]">Item</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Ordered</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Unit</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Unit price</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Received</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mrfItems.map((item, idx) => {
                          const unitPrice = (item as { unitPrice?: number; unit_price?: number }).unitPrice
                            ?? (item as { unit_price?: number }).unit_price;
                          const lineTotal = unitPrice != null
                            ? Number(unitPrice) * Number(item.quantity)
                            : undefined;
                          return (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{item.itemName}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{item.unit ?? "—"}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {unitPrice != null ? String(unitPrice) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                inputMode="decimal"
                                value={qtyOverrides[idx] ?? ""}
                                placeholder={String(item.quantity)}
                                onChange={(e) =>
                                  setQtyOverrides((prev) => ({
                                    ...prev,
                                    [idx]: e.target.value,
                                  }))
                                }
                                disabled={isGenerating || isPreviewing}
                                className="ml-auto h-8 w-24 text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {lineTotal != null ? lineTotal.toLocaleString() : "—"}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviewLocal}
                  disabled={!canGenerate || isPreviewingLocal || isGenerating || isPreviewing}
                  title="Render the Emerald-layout GRN PDF locally from form values."
                >
                  {isPreviewingLocal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering…
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" /> Preview locally
                    </>
                  )}
                </Button>
                {showServerPreview && (
                <Button
                  variant="outline"
                  onClick={handlePreviewGRN}
                  disabled={isPreviewing || isGenerating}
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating server preview…
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" /> Preview (server)
                    </>
                  )}
                </Button>
                )}
                <Button onClick={handleGenerateGRN} disabled={!canGenerate || isGenerating || isPreviewing}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                    </>
                  ) : (
                    "Confirm & Generate"
                  )}
                </Button>
              </DialogFooter>
              </>
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-4 pt-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upload an externally prepared GRN document confirming that
                  goods have been received.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="grn-file">GRN Document *</Label>
                <Input
                  id="grn-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={isCompleting}
                />
                {grnFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>
                      {grnFile.name} ({(grnFile.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX (Max 10MB)
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isCompleting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCompleteGRN} disabled={isCompleting || !grnFile}>
                  {isCompleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    "Upload GRN"
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
