import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Download, FileText, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { jccApi } from "@/services/logisticsApi";
import type { Trip, JCC, JCCLineItem } from "@/types/logistics";
import { openJccPdfFromDialogState } from "@/utils/jccPdfActions";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

interface Props {
  trip: Trip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyRow = (): JCCLineItem => ({ description: "", trip: "", durationDate: "", remarks: "" });

const buildStatement = (trip: Trip | null) => {
  if (!trip) return "";
  const start = trip.scheduledDepartureAt ? new Date(trip.scheduledDepartureAt).toLocaleDateString() : "[Start Date]";
  const end = (trip as any).scheduledArrivalAt ? new Date((trip as any).scheduledArrivalAt).toLocaleDateString() : "[End Date]";
  const svc = trip.type ? `${trip.type} transport` : "[service type]";
  const po = (trip as any).poNumber ?? "[PO Number]";
  return `This is to certify that ${svc} services were satisfactorily completed under PO ${po} between ${start} and ${end}.`;
};

export function JCCDialog({ trip, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"draft" | "submit" | "approve" | null>(null);
  const [jcc, setJcc] = useState<JCC | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [dateIssued, setDateIssued] = useState<string>(todayISO());
  const [statement, setStatement] = useState<string>("");
  const [rows, setRows] = useState<JCCLineItem[]>([emptyRow()]);
  const [status, setStatus] = useState<JCC["status"]>("draft");
  const [askPrefill, setAskPrefill] = useState(false);
  const prefillRef = useRef<JCCLineItem[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const isApprover = getScmRole(user) === "supply_chain_director";

  useEffect(() => {
    if (!open || !trip) return;
    let active = true;
    setLoading(true);
    (async () => {
      const existing = await jccApi.get(trip.id);
      if (!active) return;
      if (existing.success && existing.data) {
        const j: any = existing.data;
        setJcc(j);
        setReferenceNumber(j.referenceNumber ?? j.reference_number ?? "");
        setDateIssued(j.dateIssued ?? j.date_issued ?? todayISO());
        setStatement(j.certificationStatement ?? j.certification_statement ?? buildStatement(trip));
        const lis: any[] = j.lineItems ?? j.line_items ?? [];
        const mapped: JCCLineItem[] = lis.length
          ? lis.map((li) => ({
              id: li.id,
              description: li.description ?? "",
              trip: li.trip ?? "",
              durationDate: li.durationDate ?? li.duration_date ?? "",
              remarks: li.remarks ?? "",
            }))
          : [emptyRow()];
        setRows(mapped);
        setStatus((j.status ?? "draft") as JCC["status"]);
      } else {
        // 404 / fresh
        setJcc(null);
        setReferenceNumber("");
        setDateIssued(todayISO());
        setStatement(buildStatement(trip));
        setRows([emptyRow()]);
        setStatus("draft");
      }

      // prefill suggestion: only when local rows are empty
      const pre = await jccApi.getPrefill(trip.id);
      if (!active) return;
      if (pre.success && Array.isArray(pre.data) && pre.data.length > 0) {
        // determine if local rows are empty (single empty row)
        const localEmpty = (existing.success && existing.data
          ? ((existing.data as any).lineItems ?? (existing.data as any).line_items ?? []).length === 0
          : true);
        if (localEmpty) {
          prefillRef.current = pre.data.map((s) => ({
            description: s.description,
            trip: s.trip,
            durationDate: s.durationDate,
            remarks: s.remarks,
          }));
          setAskPrefill(true);
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, trip]);

  const acceptPrefill = () => {
    if (prefillRef.current && prefillRef.current.length > 0) {
      setRows(prefillRef.current);
    }
    setAskPrefill(false);
  };

  const updateRow = (i: number, patch: Partial<JCCLineItem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((p) => [...p, emptyRow()]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  const persist = async (mode: "draft" | "submit" | "approve") => {
    if (!trip) return;
    if (rows.length === 0 || rows.every((r) => !r.description.trim())) {
      toast({ variant: "destructive", title: "Add at least one line item" });
      return;
    }
    setSaving(mode);
    const payload: Partial<JCC> = {
      tripId: trip.id,
      dateIssued,
      certificationStatement: statement,
      lineItems: rows.filter((r) => r.description.trim()),
    };
    const res = jcc ? await jccApi.update(trip.id, payload) : await jccApi.create(trip.id, payload);
    if (!res.success || !res.data) {
      setSaving(null);
      toast({ variant: "destructive", title: "Save failed", description: res.error });
      return;
    }
    const saved: any = res.data;
    setJcc(saved);
    setReferenceNumber(saved.referenceNumber ?? saved.reference_number ?? referenceNumber);

    if (mode === "submit") {
      const sub = await jccApi.submit(trip.id);
      if (sub.success) {
        setStatus("submitted");
        toast({ title: "JCC submitted" });
      } else {
        toast({ variant: "destructive", title: "Submit failed", description: sub.error });
      }
    } else if (mode === "approve") {
      const apv = await jccApi.approve(trip.id);
      if (apv.success) {
        setStatus("approved");
        toast({ title: "JCC approved", description: "Trip closed." });
      } else {
        toast({ variant: "destructive", title: "Approval failed", description: apv.error });
      }
    } else {
      toast({ title: "Draft saved" });
    }
    setSaving(null);
    window.dispatchEvent(new CustomEvent("app:refresh"));
  };

  const downloadPdf = async () => {
    if (!trip) return;
    // Primary path: client-rendered Emerald-layout PDF from current dialog state.
    try {
      await openJccPdfFromDialogState({
        trip,
        jcc,
        referenceNumber,
        dateIssued,
        certificationStatement: statement,
        lineItems: rows,
        emeraldSignatoryName: getScmRole(user) === "supply_chain_director" ? user?.name : undefined,
      });
      return;
    } catch (e) {
      // Fallback: backend-rendered PDF (legacy server route).
      const blob = await jccApi.downloadPdf(trip.id);
      if (!blob) {
        toast({
          variant: "destructive",
          title: "PDF unavailable",
          description: e instanceof Error ? e.message : "Backend rendering not enabled yet.",
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JCC-${referenceNumber || trip.tripNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const previewDraft = async () => {
    if (!trip) return;
    try {
      await openJccPdfFromDialogState({
        trip,
        jcc,
        referenceNumber,
        dateIssued,
        certificationStatement: statement,
        lineItems: rows,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Preview failed",
        description: e instanceof Error ? e.message : "Could not render JCC preview.",
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto max-h-screen">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Job Completion Certificate</SheetTitle>
              <Badge variant={status === "approved" ? "default" : "outline"} className="capitalize">{status}</Badge>
            </div>
            <SheetDescription>
              {trip ? <>Trip <span className="font-medium">{trip.tripNumber}</span></> : null}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reference Number</Label>
                  <Input value={referenceNumber || "—"} readOnly />
                  {!referenceNumber && <p className="text-xs text-muted-foreground">Generated when you save</p>}
                </div>
                <div className="space-y-2">
                  <Label>Date Issued</Label>
                  <Input type="date" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input value={trip?.vendorName ?? ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Issued By</Label>
                  <Input value={user?.name ?? ""} readOnly />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Certification Statement</Label>
                <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> Add row</Button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Trip</TableHead>
                        <TableHead>Duration / Date</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell><Textarea rows={2} value={r.description} onChange={(e) => updateRow(i, { description: e.target.value })} /></TableCell>
                          <TableCell><Input value={r.trip} onChange={(e) => updateRow(i, { trip: e.target.value })} /></TableCell>
                          <TableCell><Input value={r.durationDate} onChange={(e) => updateRow(i, { durationDate: e.target.value })} /></TableCell>
                          <TableCell><Input value={r.remarks} onChange={(e) => updateRow(i, { remarks: e.target.value })} /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Signatory</p>
                  <p className="font-medium">{user?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{getScmRole(user)?.replace(/_/g, " ")}</p>
                </div>
              </div>

              {/* Hidden printable preview */}
              <div ref={printRef} className="hidden">
                <h1>Job Completion Certificate (Draft Preview)</h1>
                <p><strong>Reference:</strong> {referenceNumber || "—"}</p>
                <p><strong>Date Issued:</strong> {dateIssued}</p>
                <p><strong>Vendor:</strong> {trip?.vendorName ?? ""}</p>
                <p><strong>Trip:</strong> {trip?.tripNumber ?? ""}</p>
                <h2>Certification</h2>
                <p>{statement}</p>
                <h2>Line Items</h2>
                <table>
                  <thead><tr><th>#</th><th>Description</th><th>Trip</th><th>Duration/Date</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}><td>{i + 1}</td><td>{r.description}</td><td>{r.trip}</td><td>{r.durationDate}</td><td>{r.remarks}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop: 32 }}><strong>Signed:</strong> {user?.name}</p>
              </div>
            </div>
          )}

          <SheetFooter className="mt-6 flex-wrap gap-2">
            <Button variant="outline" onClick={previewDraft}>
              <Printer className="h-4 w-4 mr-2" /> Preview Draft (browser render)
            </Button>
            <Button variant="outline" onClick={downloadPdf} disabled={!jcc} title={!jcc ? "Save first" : "Download official PDF"}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            {status !== "approved" && (
              <>
                <Button variant="secondary" onClick={() => persist("draft")} disabled={!!saving}>
                  {saving === "draft" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Draft
                </Button>
                {status !== "submitted" && (
                  <Button onClick={() => persist("submit")} disabled={!!saving}>
                    {saving === "submit" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit JCC
                  </Button>
                )}
                {status === "submitted" && isApprover && (
                  <Button onClick={() => persist("approve")} disabled={!!saving}>
                    {saving === "approve" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Approve JCC
                  </Button>
                )}
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={askPrefill} onOpenChange={setAskPrefill}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pre-fill from vendor submissions?</AlertDialogTitle>
            <AlertDialogDescription>
              We found {prefillRef.current?.length ?? 0} suggested line items from vendor trip submissions. Pre-fill the table?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={acceptPrefill}>Pre-fill</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default JCCDialog;