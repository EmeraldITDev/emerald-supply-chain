import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FileText, Download, TrendingUp, Calendar, BarChart3, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";
import { printPage } from "@/utils/exportData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Reports = () => {
  const { toast } = useToast();
  const { mrfRequests, srfRequests } = useApp();
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [reportType, setReportType] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false);
  const [selectedScheduledReport, setSelectedScheduledReport] = useState<any>(null);
  
  const handleExportData = (format: 'csv' | 'excel' | 'json') => {
    const data = mrfRequests.map(mrf => ({
      ID: mrf.id,
      Title: mrf.title,
      Category: mrf.category,
      Status: mrf.currentStage,
      Requester: mrf.requester,
      Date: mrf.date,
      Cost: mrf.estimatedCost,
      Urgency: mrf.urgency
    }));
    
    // Simple export implementation
    if (format === 'csv' || format === 'excel') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SCM_Report_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xls' : 'csv'}`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Export Complete", description: `Data exported as ${format.toUpperCase()}` });
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SCM_Report_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Export Complete", description: "Data exported as JSON" });
    }
  };
  
  const recentReports = [
    { name: "Monthly Procurement Summary", type: "Procurement", date: "2024-01-01", status: "Ready", size: "2.4 MB" },
    { name: "Inventory Valuation Report", type: "Inventory", date: "2024-01-15", status: "Ready", size: "1.8 MB" },
    { name: "Logistics Performance", type: "Logistics", date: "2024-01-10", status: "Ready", size: "3.1 MB" },
    { name: "Vendor Evaluation Q1", type: "Vendors", date: "2024-01-05", status: "Processing", size: "-" },
  ];

  const scheduledReports = [
    { name: "Weekly Stock Report", frequency: "Weekly", nextRun: "2024-01-22", recipients: 5 },
    { name: "Monthly Financial Summary", frequency: "Monthly", nextRun: "2024-02-01", recipients: 8 },
    { name: "Daily Operations Report", frequency: "Daily", nextRun: "Tomorrow", recipients: 12 },
  ];

  const kpis = [
    { name: "Procurement Cycle Time", value: "12 days", change: "-8%", trend: "down" },
    { name: "Inventory Turnover", value: "6.2x", change: "+12%", trend: "up" },
    { name: "On-Time Delivery", value: "91%", change: "+5%", trend: "up" },
    { name: "Cost Savings", value: "₦2.4M", change: "+18%", trend: "up" },
  ];

  const reportCategories = [
    { name: "Procurement Analytics", description: "MRF/SRF, PO, and vendor performance", icon: FileText },
    { name: "Logistics Reports", description: "Trip efficiency, vehicle utilization", icon: TrendingUp },
    { name: "Inventory Analytics", description: "Stock levels, turnover, valuation", icon: BarChart3 },
    { name: "Warehouse Reports", description: "Space utilization, EHS compliance", icon: FileText },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ready":
        return "bg-success/10 text-success";
      case "Processing":
        return "bg-info/10 text-info";
      case "Failed":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTrendColor = (trend: string) => {
    return trend === "up" ? "text-success" : "text-destructive";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">Generate insights and track key performance indicators</p>
          </div>
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Report</DialogTitle>
                <DialogDescription>Create a new custom report</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="procurement">Procurement Analytics</SelectItem>
                      <SelectItem value="logistics">Logistics Reports</SelectItem>
                      <SelectItem value="inventory">Inventory Analytics</SelectItem>
                      <SelectItem value="warehouse">Warehouse Reports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Last Week</SelectItem>
                      <SelectItem value="month">Last Month</SelectItem>
                      <SelectItem value="quarter">Last Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full transition-transform hover:scale-105" onClick={() => {
                  if (!reportType || !dateRange) {
                    toast({ title: "Validation Error", description: "Please select report type and date range", variant: "destructive" });
                    return;
                  }
                  
                  toast({ 
                    title: "Report Generated", 
                    description: `${reportType} report for ${dateRange} is ready for download` 
                  });
                  
                  setReportType("");
                  setDateRange("");
                  setGenerateDialogOpen(false);
                }}>
                  Generate Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                <TrendingUp className={`h-4 w-4 ${getTrendColor(kpi.trend)}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className={`text-xs ${getTrendColor(kpi.trend)}`}>
                  {kpi.change} from last period
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Recently generated reports and documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentReports.map((report) => (
                  <div key={report.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{report.name}</span>
                        <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Type: {report.type}</span>
                        <span>Date: {report.date}</span>
                        <span>Size: {report.size}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 transition-transform hover:scale-105" 
                      disabled={report.status !== "Ready"}
                      onClick={() => {
                        // Simulate download
                        const link = document.createElement('a');
                        link.href = '#';
                        link.download = `${report.name}.pdf`;
                        toast({ 
                          title: "Download Started", 
                          description: `Downloading ${report.name}` 
                        });
                      }}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Automated report generation schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledReports.map((report) => (
                  <div key={report.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{report.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Frequency: {report.frequency}</span>
                        <span>Next: {report.nextRun}</span>
                        <span>Recipients: {report.recipients}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedScheduledReport(report);
                        setConfigureDialogOpen(true);
                      }}
                      className="transition-transform hover:scale-105"
                    >
                      Configure
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="categories">Report Categories</TabsTrigger>
            <TabsTrigger value="custom">Custom Reports</TabsTrigger>
            <TabsTrigger value="exports">Data Exports</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {reportCategories.map((category) => (
                <Card key={category.name} className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className="h-5 w-5 text-primary" />
                      {category.name}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full transition-transform hover:scale-105"
                      onClick={() => {
                        toast({ 
                          title: "Generating Report", 
                          description: `Creating ${category.name}. You'll be notified when ready.` 
                        });
                      }}
                    >
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Custom Report Builder</CardTitle>
                <CardDescription>Create customized reports with specific metrics and filters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Build custom reports tailored to your specific needs
                  </p>
                  <Button 
                    className="transition-transform hover:scale-105"
                    onClick={() => {
                      toast({ 
                        title: "Custom Report Builder", 
                        description: "Feature available with backend integration"
                      });
                    }}
                  >
                    Create Custom Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Export Tools</CardTitle>
                <CardDescription>Export data to various formats for external analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Button 
                    variant="outline" 
                    className="h-24 flex-col gap-2 transition-transform hover:scale-105"
                    onClick={() => handleExportData('excel')}
                  >
                    <FileText className="h-6 w-6" />
                    Export to Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-24 flex-col gap-2 transition-transform hover:scale-105"
                    onClick={() => {
                      toast({ 
                        title: "PDF Export", 
                        description: "PDF export requires backend integration" 
                      });
                    }}
                  >
                    <FileText className="h-6 w-6" />
                    Export to PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-24 flex-col gap-2 transition-transform hover:scale-105"
                    onClick={() => handleExportData('csv')}
                  >
                    <FileText className="h-6 w-6" />
                    Export to CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Configure Scheduled Report Dialog */}
      <Dialog open={configureDialogOpen} onOpenChange={setConfigureDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Scheduled Report</DialogTitle>
            <DialogDescription>
              {selectedScheduledReport?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedScheduledReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Frequency</Label>
                  <p className="font-medium">{selectedScheduledReport.frequency}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Next Run</Label>
                  <p className="font-medium">{selectedScheduledReport.nextRun}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Recipients</Label>
                  <p className="font-medium">{selectedScheduledReport.recipients} users</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    toast({ 
                      title: "Report Triggered", 
                      description: `Generating ${selectedScheduledReport.name} now` 
                    });
                    setConfigureDialogOpen(false);
                  }}
                >
                  Run Now
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setConfigureDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Reports;
