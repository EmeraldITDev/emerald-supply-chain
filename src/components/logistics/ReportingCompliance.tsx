import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  FileText,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  Send,
  Loader2,
  RefreshCw,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { reportsApi } from "@/services/logisticsApi";
import type { LogisticsReport, PendingReport, ReportStatus, ReportType, CreateReportData } from "@/types/logistics";

const statusColors: Record<ReportStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  reviewed: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const typeLabels: Record<ReportType, string> = {
  trip: "Trip Report",
  daily: "Daily Report",
  weekly: "Weekly Report",
  monthly: "Monthly Report",
  incident: "Incident Report",
  compliance: "Compliance Report",
  custom: "Custom Report",
};

export const ReportingCompliance = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<LogisticsReport[]>([]);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<LogisticsReport | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<CreateReportData>>({
    type: "daily",
  });
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch reports
  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, pendingRes] = await Promise.all([
        reportsApi.getAll({
          status: statusFilter !== "all" ? statusFilter : undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
        }),
        reportsApi.getPending(),
      ]);

      if (reportsRes.success && reportsRes.data) {
        setReports(reportsRes.data);
      } else {
        setReports(getMockReports());
      }

      if (pendingRes.success && pendingRes.data) {
        setPendingReports(pendingRes.data);
      } else {
        setPendingReports(getMockPendingReports());
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      setReports(getMockReports());
      setPendingReports(getMockPendingReports());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter]);

  const handleCreateReport = async () => {
    if (!formData.title || !formData.type) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const reportData: CreateReportData = {
        type: formData.type as ReportType,
        title: formData.title!,
        description: formData.description,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        tripId: formData.tripId,
        content: formData.content,
      };

      const response = await reportsApi.create(reportData);

      if (response.success) {
        toast({
          title: "Report Created",
          description: `${formData.title} has been created`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        // Add to local state for demo
        const newReport: LogisticsReport = {
          id: `RPT-${Date.now()}`,
          reportNumber: `RPT-2025-${String(reports.length + 1).padStart(3, "0")}`,
          type: formData.type as ReportType,
          title: formData.title!,
          description: formData.description,
          status: "draft",
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          content: formData.content,
          submittedBy: localStorage.getItem("userName") || "System",
          createdAt: new Date().toISOString(),
        };
        setReports(prev => [newReport, ...prev]);
        toast({
          title: "Report Created (Local)",
          description: `${formData.title} has been created as draft`,
        });
        setCreateDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReport = async (reportId: string) => {
    try {
      const response = await reportsApi.submit(reportId);
      if (response.success) {
        toast({
          title: "Report Submitted",
          description: "Report has been submitted for review",
        });
        fetchData();
      } else {
        // Update local state for demo
        setReports(prev => prev.map(r =>
          r.id === reportId
            ? { ...r, status: "submitted" as ReportStatus, submittedAt: new Date().toISOString() }
            : r
        ));
        toast({
          title: "Report Submitted (Local)",
          description: "Report has been submitted for review",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit report",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({ type: "daily" });
    setReportFile(null);
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch =
      report.reportNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const overdueReports = pendingReports.filter(r => r.daysOverdue && r.daysOverdue > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Reporting & Compliance</h2>
          <p className="text-sm text-muted-foreground">
            Submit and track operational reports
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Report</DialogTitle>
              <DialogDescription>
                Create a new operational report
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Report Type *</Label>
                  <Select
                    value={formData.type || "daily"}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as ReportType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trip">Trip Report</SelectItem>
                      <SelectItem value="daily">Daily Report</SelectItem>
                      <SelectItem value="weekly">Weekly Report</SelectItem>
                      <SelectItem value="monthly">Monthly Report</SelectItem>
                      <SelectItem value="incident">Incident Report</SelectItem>
                      <SelectItem value="compliance">Compliance Report</SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Report title"
                    value={formData.title || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input
                    type="date"
                    value={formData.periodStart || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input
                    type="date"
                    value={formData.periodEnd || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of the report"
                  value={formData.description || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Report Content</Label>
                <Textarea
                  className="min-h-[150px]"
                  placeholder="Enter report details..."
                  value={formData.content || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Attach File (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Input
                    type="file"
                    className="hidden"
                    id="report-file"
                    accept=".pdf,.doc,.docx,.xlsx"
                    onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="report-file" className="cursor-pointer">
                    <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {reportFile ? reportFile.name : "Click to attach file"}
                    </p>
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReport} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overdue Reports Alert */}
      {overdueReports.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{overdueReports.length} overdue report(s):</strong>{" "}
            {overdueReports.slice(0, 2).map(r => `${r.title} (${r.daysOverdue} days)`).join("; ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === "submitted").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === "approved").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueReports.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reports Section */}
      {pendingReports.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Pending Submissions ({pendingReports.length})
            </CardTitle>
            <CardDescription>Reports due for submission</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReports.slice(0, 5).map((pr) => (
                <div key={pr.id} className={cn(
                  "flex items-center justify-between p-3 border rounded-lg",
                  pr.daysOverdue && pr.daysOverdue > 0 && "border-destructive/50 bg-destructive/5"
                )}>
                  <div>
                    <p className="font-medium text-sm">{pr.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {new Date(pr.dueAt).toLocaleDateString()}
                      {pr.tripNumber && ` • Trip: ${pr.tripNumber}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pr.daysOverdue && pr.daysOverdue > 0 ? (
                      <Badge variant="destructive">{pr.daysOverdue} days overdue</Badge>
                    ) : (
                      <Badge className="bg-warning/10 text-warning">Due Soon</Badge>
                    )}
                    <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                      Submit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="trip">Trip</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            {filteredReports.length} report(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports found</p>
              <p className="text-sm">Create a new report to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-sm">
                        {report.reportNumber}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{report.title}</p>
                        {report.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {report.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[report.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        {report.periodStart && report.periodEnd ? (
                          <span className="text-sm">
                            {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(statusColors[report.status], "capitalize")}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.submittedAt ? (
                          new Date(report.submittedAt).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground">Not submitted</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedReport(report);
                              setViewDialogOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {report.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleSubmitReport(report.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Submit Report
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Report Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>{selectedReport?.reportNumber}</DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{typeLabels[selectedReport.type]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={cn(statusColors[selectedReport.status], "capitalize mt-1")}>
                    {selectedReport.status}
                  </Badge>
                </div>
                {selectedReport.periodStart && (
                  <div>
                    <Label className="text-muted-foreground">Period</Label>
                    <p className="font-medium">
                      {new Date(selectedReport.periodStart).toLocaleDateString()}
                      {selectedReport.periodEnd && ` - ${new Date(selectedReport.periodEnd).toLocaleDateString()}`}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Submitted By</Label>
                  <p className="font-medium">{selectedReport.submittedBy || selectedReport.submittedByName}</p>
                </div>
              </div>
              {selectedReport.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedReport.description}</p>
                </div>
              )}
              {selectedReport.content && (
                <div>
                  <Label className="text-muted-foreground">Content</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedReport.content}
                  </div>
                </div>
              )}
              {selectedReport.reviewNotes && (
                <div>
                  <Label className="text-muted-foreground">Review Notes</Label>
                  <p className="text-sm text-muted-foreground">{selectedReport.reviewNotes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedReport?.status === "draft" && (
              <Button onClick={() => {
                handleSubmitReport(selectedReport.id);
                setViewDialogOpen(false);
              }}>
                <Send className="mr-2 h-4 w-4" />
                Submit Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Mock data for development
function getMockReports(): LogisticsReport[] {
  return [
    {
      id: "rpt-001",
      reportNumber: "RPT-2025-001",
      type: "weekly",
      title: "Weekly Operations Report - Week 5",
      description: "Summary of logistics operations for week 5",
      status: "approved",
      periodStart: "2025-01-27",
      periodEnd: "2025-02-02",
      submittedBy: "John Coordinator",
      submittedAt: "2025-02-03",
      reviewedBy: "Manager Smith",
      reviewedAt: "2025-02-03",
      createdAt: "2025-02-02",
    },
    {
      id: "rpt-002",
      reportNumber: "RPT-2025-002",
      type: "trip",
      title: "Trip Report - TRP-2025-003",
      description: "Post-trip report for Port Harcourt to Lagos journey",
      status: "submitted",
      tripId: "trip-003",
      submittedBy: "Driver Musa",
      submittedAt: "2025-02-03",
      createdAt: "2025-02-03",
    },
    {
      id: "rpt-003",
      reportNumber: "RPT-2025-003",
      type: "daily",
      title: "Daily Operations Log - Feb 2",
      status: "draft",
      periodStart: "2025-02-02",
      periodEnd: "2025-02-02",
      submittedBy: "Admin",
      createdAt: "2025-02-02",
    },
    {
      id: "rpt-004",
      reportNumber: "RPT-2025-004",
      type: "incident",
      title: "Incident Report - Vehicle Breakdown",
      description: "Report on VEH-003 breakdown on Lokoja highway",
      status: "reviewed",
      submittedBy: "Driver Bakare",
      submittedAt: "2025-01-28",
      reviewNotes: "Under investigation",
      createdAt: "2025-01-28",
    },
  ];
}

function getMockPendingReports(): PendingReport[] {
  return [
    {
      id: "pending-001",
      type: "trip",
      title: "Trip Report - TRP-2025-001",
      dueAt: "2025-02-05",
      assignedTo: "driver-001",
      assignedToName: "Ibrahim Musa",
      tripId: "trip-001",
      tripNumber: "TRP-2025-001",
    },
    {
      id: "pending-002",
      type: "weekly",
      title: "Weekly Report - Week 6",
      dueAt: "2025-02-01",
      assignedTo: "coord-001",
      assignedToName: "Logistics Coordinator",
      daysOverdue: 2,
    },
  ];
}

export default ReportingCompliance;
