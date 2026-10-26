import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { PoRegisterRow } from "@/services/reportsApi";

interface PoRegisterTableProps {
  rows: PoRegisterRow[];
  loading?: boolean;
  onExport: (format: "xlsx" | "pdf") => void;
  exporting?: boolean;
}

export function PoRegisterTable({ rows, loading, onExport, exporting }: PoRegisterTableProps) {
  const hasRows = rows.length > 0;
  const formatMoney = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: currency || "NGN",
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency || "NGN"} ${value.toLocaleString()}`;
    }
  };

  if (loading) {
    return <Card><CardContent className="py-10 text-sm text-muted-foreground text-center">Loading PO register…</CardContent></Card>;
  }

  if (!hasRows) {
    return <Card><CardContent className="py-10 text-sm text-muted-foreground text-center">No generated POs match the active filters.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Purchase Order Register</CardTitle>
          <CardDescription>All generated SCM purchase orders matching the selected filters.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport("xlsx")} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport("pdf")} disabled={exporting}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>MRF</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Procurement Manager</TableHead>
              <TableHead>PO Generated</TableHead>
              <TableHead>Signed Date</TableHead>
              <TableHead>PO Value</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Signing</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>GRN</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead>Docs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.poNumber ?? "Not Available"}</TableCell>
                <TableCell>{row.poVersion ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.mrfNumber ?? "Not Available"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{row.title}</TableCell>
                <TableCell>{row.vendorName ?? "Not Available"}</TableCell>
                <TableCell>{row.department ?? "Not Available"}</TableCell>
                <TableCell>{row.contractType ?? "Not Available"}</TableCell>
                <TableCell>{row.currency ?? "NGN"}</TableCell>
                <TableCell>{row.procurementManager ?? "Not Assigned"}</TableCell>
                <TableCell>{row.poGenerationDate ?? "—"}</TableCell>
                <TableCell>{row.poSigningDate ?? "—"}</TableCell>
                <TableCell>{formatMoney(row.poValue ?? 0, row.currency ?? "NGN")}</TableCell>
                <TableCell>{formatMoney(row.taxAmount ?? 0, row.currency ?? "NGN")}</TableCell>
                <TableCell>{row.approvalStatus ?? "Not Recorded"}</TableCell>
                <TableCell>{row.signingStatus ?? "Not Recorded"}</TableCell>
                <TableCell>{row.paymentStatus ?? "Not Recorded"}</TableCell>
                <TableCell>{row.grnStatus ?? "Not Recorded"}</TableCell>
                <TableCell>{row.expectedDeliveryDate ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.signedPoUrl ? (
                      <a href={row.signedPoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Signed
                      </a>
                    ) : null}
                    {row.unsignedPoUrl ? (
                      <a href={row.unsignedPoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Unsigned
                      </a>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
