import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Truck, Warehouse, TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  
  const stats = [
    {
      title: "Pending Requests",
      value: "12",
      description: "Awaiting approval",
      icon: Clock,
      trend: "+2 from yesterday",
      color: "text-warning",
    },
    {
      title: "Active POs",
      value: "28",
      description: "In progress",
      icon: ShoppingCart,
      trend: "+5 this week",
      color: "text-primary",
    },
    {
      title: "Total Vendors",
      value: "45",
      description: "Registered suppliers",
      icon: Package,
      trend: "+3 this month",
      color: "text-info",
    },
    {
      title: "Completed",
      value: "156",
      description: "This month",
      icon: CheckCircle,
      trend: "+12% vs last month",
      color: "text-success",
    },
  ];

  const recentActivities = [
    { id: 1, type: "MRF", title: "Office Supplies Request", status: "Pending", date: "2 hours ago" },
    { id: 2, type: "PO", title: "IT Equipment Purchase", status: "Approved", date: "5 hours ago" },
    { id: 3, type: "SRF", title: "Maintenance Service", status: "In Review", date: "1 day ago" },
    { id: 4, type: "MRF", title: "Raw Materials Restock", status: "Completed", date: "2 days ago" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Overview of your supply chain operations</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest procurement actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/procurement/mrf/new")}>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Package className="h-8 w-8 text-primary mb-2" />
                    <p className="font-medium text-sm">New MRF</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/procurement/srf/new")}>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <ShoppingCart className="h-8 w-8 text-primary mb-2" />
                    <p className="font-medium text-sm">New SRF</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/logistics")}>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Truck className="h-8 w-8 text-primary mb-2" />
                    <p className="font-medium text-sm">Logistics</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/inventory")}>
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <Warehouse className="h-8 w-8 text-primary mb-2" />
                    <p className="font-medium text-sm">Inventory</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
