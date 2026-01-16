import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, Truck, Warehouse, TrendingUp, AlertCircle, CheckCircle, Clock, Users, FileText, Activity } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DepartmentDashboard from "./DepartmentDashboard";
import FinanceDashboard from "./FinanceDashboard";
import { PullToRefresh } from "@/components/PullToRefresh";
import { dashboardApi, mrfApi } from "@/services/api";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // Route to role-specific dashboard
  if (user?.role === "employee") {
    return <DepartmentDashboard />;
  }

  if (user?.role === "finance") {
    return (
      <DashboardLayout>
        <FinanceDashboard />
      </DashboardLayout>
    );
  }

  if (user?.role === "executive") {
    return <Navigate to="/executive" replace />;
  }

  if (user?.role === "chairman") {
    return <Navigate to="/chairman" replace />;
  }

  if (user?.role === "supply_chain_director" || user?.role === "supply_chain") {
    return <Navigate to="/supply-chain" replace />;
  }

  if (user?.role === "procurement") {
    return <Navigate to="/procurement" replace />;
  }

  if (user?.role === "logistics") {
    return <Navigate to="/logistics" replace />;
  }

  // Fetch dashboard data for procurement_manager
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (user?.role === "procurement_manager") {
        setLoading(true);
        try {
          const response = await dashboardApi.getProcurementManagerDashboard();
          if (response.success && response.data) {
            setDashboardData(response.data);
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to load dashboard data",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();
  }, [user?.role, toast]);

  // Fetch recent activities
  useEffect(() => {
    const fetchRecentActivities = async () => {
      setActivitiesLoading(true);
      try {
        // Fetch recent MRFs
        const mrfResponse = await mrfApi.getAll();
        if (mrfResponse.success && mrfResponse.data) {
          const activities: any[] = [];
          
          // Add MRF activities
          mrfResponse.data.slice(0, 10).forEach((mrf: any) => {
            activities.push({
              id: mrf.id,
              type: "MRF",
              title: mrf.title,
              description: `MRF ${mrf.mrf_id || mrf.id} - ${mrf.status}`,
              status: mrf.status,
              date: mrf.created_at || mrf.date,
              actionUrl: `/procurement?mrf=${mrf.id}`,
            });
          });

          // Sort by date (most recent first)
          activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setRecentActivities(activities.slice(0, 20));
        }
      } catch (error) {
        console.error("Failed to fetch recent activities", error);
      } finally {
        setActivitiesLoading(false);
      }
    };

    if (user) {
      fetchRecentActivities();
      // Refresh activities every 30 seconds
      const interval = setInterval(fetchRecentActivities, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleRefresh = async () => {
    if (user?.role === "procurement_manager") {
      setLoading(true);
      try {
        const response = await dashboardApi.getProcurementManagerDashboard();
        if (response.success && response.data) {
          setDashboardData(response.data);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to refresh dashboard data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // Procurement dashboard (default) - All stats from live database
  const stats = [
    {
      title: "Total Vendors",
      value: dashboardData?.stats?.totalVendors?.toString() || "0",
      description: "Active suppliers",
      icon: Package,
      trend: "Registered",
      color: "text-info",
    },
    {
      title: "Pending KYC",
      value: dashboardData?.stats?.pendingKYC?.toString() || "0",
      description: "Vendor registrations",
      icon: Users,
      trend: "Awaiting review",
      color: "text-warning",
    },
    {
      title: "Awaiting Review",
      value: dashboardData?.stats?.awaitingReview?.toString() || "0",
      description: "Pending registrations",
      icon: Clock,
      trend: "Needs attention",
      color: "text-warning",
    },
    {
      title: "Avg Rating",
      value: dashboardData?.stats?.avgRating ? `${dashboardData.stats.avgRating.toFixed(1)}/5.0` : "0.0/5.0",
      description: "Vendor performance",
      icon: TrendingUp,
      trend: "Average rating",
      color: "text-success",
    },
    {
      title: "On-Time Delivery",
      value: dashboardData?.stats?.onTimeDelivery ? `${dashboardData.stats.onTimeDelivery}%` : "0%",
      description: "Delivery performance",
      icon: CheckCircle,
      trend: "On-time rate",
      color: "text-success",
    },
    {
      title: "Pending MRFs",
      value: dashboardData?.stats?.pendingMRFs?.toString() || "0",
      description: "Material requests",
      icon: Clock,
      trend: "Awaiting approval",
      color: "text-warning",
    },
  ];

  // Fallback activities for the overview card (if no pending registrations)
  const fallbackActivities = [
    { id: 1, type: "MRF", title: "Office Supplies Request", status: "Pending", date: "2 hours ago" },
    { id: 2, type: "PO", title: "IT Equipment Purchase", status: "Approved", date: "5 hours ago" },
    { id: 3, type: "SRF", title: "Maintenance Service", status: "In Review", date: "1 day ago" },
    { id: 4, type: "MRF", title: "Raw Materials Restock", status: "Completed", date: "2 days ago" },
  ];

  return (
    <DashboardLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Procurement Dashboard</h1>
            <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">Overview of your supply chain operations</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activities">Recent Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {stats.map((stat) => (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
                    <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className={`h-3 w-3 sm:h-4 sm:w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                    <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground hidden sm:block">{stat.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden lg:block">{stat.trend}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">
                {dashboardData?.pendingRegistrations?.length ? "Pending Vendor Registrations" : "Recent Activities"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {dashboardData?.pendingRegistrations?.length 
                  ? `${dashboardData.pendingRegistrations.length} awaiting review`
                  : "Latest procurement actions"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {loading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
              ) : dashboardData?.pendingRegistrations?.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {dashboardData.pendingRegistrations.slice(0, 5).map((reg: any) => (
                    <div 
                      key={reg.id} 
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 last:border-0 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors"
                      onClick={() => navigate(`/vendors/registration/${reg.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{reg.companyName}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {reg.category} • {new Date(reg.createdAt).toLocaleDateString()}
                        </p>
                        {reg.contactPerson && (
                          <p className="text-xs text-muted-foreground mt-1">Contact: {reg.contactPerson}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="self-start sm:self-center">
                        Pending Review
                      </Badge>
                    </div>
                  ))}
                  {dashboardData.pendingRegistrations.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-2"
                      onClick={() => navigate("/vendors")}
                    >
                      View All ({dashboardData.pendingRegistrations.length})
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {fallbackActivities.map((activity) => (
                    <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{activity.title}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{activity.type} • {activity.date}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full self-start sm:self-center whitespace-nowrap ${
                          activity.status === "Completed"
                            ? "bg-accent text-accent-foreground"
                            : activity.status === "Approved"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Only employees can create MRF/SRF */}
                {user?.role === "employee" && (
                  <>
                    <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/procurement/mrf/new")}>
                      <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                        <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                        <p className="font-medium text-xs sm:text-sm">New MRF</p>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/procurement/srf/new")}>
                      <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                        <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                        <p className="font-medium text-xs sm:text-sm">New SRF</p>
                      </CardContent>
                    </Card>
                  </>
                )}
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/logistics")}>
                  <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                    <Truck className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                    <p className="font-medium text-xs sm:text-sm">Logistics</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/inventory")}>
                  <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                    <Warehouse className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                    <p className="font-medium text-xs sm:text-sm">Inventory</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
          </TabsContent>

          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activities
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Latest MRF requests, PO generations, and workflow updates
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {activitiesLoading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Loading activities...</div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activities</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (activity.actionUrl) {
                            navigate(activity.actionUrl);
                          }
                        }}
                      >
                        <div className="mt-0.5">
                          {activity.type === "MRF" ? (
                            <FileText className="h-4 w-4 text-primary" />
                          ) : activity.type === "PO" ? (
                            <ShoppingCart className="h-4 w-4 text-success" />
                          ) : (
                            <Activity className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activity.description || activity.type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.date).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={activity.status === "Approved" || activity.status === "Completed" ? "default" : "secondary"}>
                          {activity.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </PullToRefresh>
    </DashboardLayout>
  );
};

export default Dashboard;
