import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FileText, Download, TrendingUp, Calendar, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportsApi, type ReportsDashboardData } from "@/services/reportsApi";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { cn } from "@/lib/utils";

function defaultDashboardDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const Reports = () => {
  const defaults = defaultDashboardDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<ReportsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getDashboard(from || undefined, to || undefined);
      if (res.success && res.data) {
        setDashboard(res.data);
      } else {
        setDashboard(null);
        setError(res.error || "Failed to load reports dashboard");
      }
    } catch (e: unknown) {
      setDashboard(null);
      setError(e instanceof Error ? e.message : "Failed to load reports dashboard");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "Ready":
        return "bg-success/10 text-success";
      case "processing":
      case "Processing":
        return "bg-info/10 text-info";
      case "failed":
      case "Failed":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTrendColor = (trend: string) => {
    if (trend === "flat") return "text-muted-foreground";
    return trend === "up" ? "text-success" : "text-destructive";
  };

  const reportCategories = [
    { name: "Procurement Analytics", description: "MRF/SRF, PO, and vendor performance", href: "/reports/procurement", icon: FileText },
    { name: "Logistics Reports", description: "Trip efficiency and compliance reporting", href: "/logistics", icon: TrendingUp },
    { name: "Finance AP Reports", description: "Post-cutover Finance AP cohort metrics", href: "/reports/procurement#finance-ap", icon: BarChart3 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">Live metrics from the database — no static placeholders</p>
          </div>
          <Button variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dashboard period</CardTitle>
            <CardDescription>Defaults to the last 30 days when left blank</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1 flex-1">
              <Label htmlFor="dash-from">From</Label>
              <Input id="dash-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="dash-to">To</Label>
              <Input id="dash-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={loadDashboard} disabled={loading}>Apply</Button>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {loading && !dashboard ? (
          <TableSkeleton rows={4} />
        ) : dashboard ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {dashboard.kpis.map((kpi) => (
                <Card key={kpi.name}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                    <TrendingUp className={`h-4 w-4 ${getTrendColor(kpi.trend)}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                    <p className={`text-xs ${getTrendColor(kpi.trend)}`}>
                      {kpi.change} vs previous period
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reports</CardTitle>
                  <CardDescription>Generated exports stored in the database</CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboard.recentReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No generated reports yet. Export from Procurement Reports to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {dashboard.recentReports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{report.name}</span>
                              <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Type: {report.type}</span>
                              <span>Date: {report.date || "—"}</span>
                              <span>Size: {report.size}</span>
                            </div>
                          </div>
                          {report.downloadUrl && report.status === "completed" ? (
                            <Button variant="outline" size="sm" className="gap-2" asChild>
                              <a href={report.downloadUrl} download>
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              <Download className="h-3 w-3" />
                              Unavailable
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Reports</CardTitle>
                  <CardDescription>Active schedules from the database</CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboard.scheduledReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No scheduled reports configured. Contact an administrator to set up automation.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {dashboard.scheduledReports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="categories">Report Categories</TabsTrigger>
            <TabsTrigger value="procurement">Procurement Engine</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {reportCategories.map((category) => (
                <Card key={category.name} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className="h-5 w-5 text-primary" />
                      {category.name}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to={category.href}>Open</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="procurement">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  Interactive procurement reporting with server-side filters and exports lives on the Procurement Reports page.
                </p>
                <Button asChild>
                  <Link to="/reports/procurement">Go to Procurement Reports</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
