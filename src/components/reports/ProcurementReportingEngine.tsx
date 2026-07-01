import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Download, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  reportsApi,
  type PaginatedReportRecords,
  type ProcurementReportRecord,
} from "@/services/reportsApi";

interface ProcurementReportingEngineProps {
  initialFrom?: string;
  initialTo?: string;
}

export const ProcurementReportingEngine = ({
  initialFrom = "",
  initialTo = "",
}: ProcurementReportingEngineProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [data, setData] = useState<PaginatedReportRecords | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getProcurementRecords({
        from: from || undefined,
        to: to || undefined,
        department: department || undefined,
        status: status || undefined,
        search: search || undefined,
        page,
        per_page: 25,
        sort_by: "created_at",
        sort_direction: "desc",
      });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData(null);
        toast({
          title: "Failed to load records",
          description: res.error || "Could not fetch procurement records",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, department, status, search, page, toast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const res = await reportsApi.exportProcurementRecords(format, {
        from: from || undefined,
        to: to || undefined,
        department: department || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      if (res.success && res.data) {
        const ext = format === "xlsx" ? "xls" : format;
        const url = window.URL.createObjectURL(res.data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `procurement-records.${ext}`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast({ title: "Export complete", description: `Downloaded ${format.toUpperCase()} from server.` });
      } else {
        toast({ title: "Export failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setExporting(null);
    }
  };

  const openRecord = (row: ProcurementReportRecord) => {
    navigate(row.detailPath);
  };

  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Procurement records</CardTitle>
        <CardDescription>
          Server-side filters, pagination, and exports. Click a row to open the MRF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="eng-from">From</Label>
            <Input id="eng-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eng-to">To</Label>
            <Input id="eng-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eng-dept">Department</Label>
            <Input id="eng-dept" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} placeholder="e.g. Operations" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eng-status">Status</Label>
            <Input id="eng-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="workflow state" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="eng-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="eng-search"
                className="pl-8"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="MRF ID or title"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={!!exporting}>
            {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} disabled={!!exporting}>
            {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={loadRecords} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Refresh
          </Button>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No procurement records match your filters.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRF</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openRecord(row)}
                  >
                    <TableCell className="font-mono text-xs">{row.displayId}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                    <TableCell>{row.department || "—"}</TableCell>
                    <TableCell className="text-xs">{row.workflowState || row.status || "—"}</TableCell>
                    <TableCell className="text-xs">{row.vendorName || "—"}</TableCell>
                    <TableCell className="text-right">₦{row.estimatedCost.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing {pagination.from ?? 0}–{pagination.to ?? 0} of {pagination.total}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 text-sm">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < pagination.totalPages) setPage(page + 1);
                        }}
                        className={page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcurementReportingEngine;
