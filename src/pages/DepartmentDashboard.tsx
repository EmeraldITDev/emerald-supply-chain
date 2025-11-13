import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Search, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

const DepartmentDashboard = () => {
  const { user } = useAuth();
  const { mrns, annualPlans } = useApp();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter MRNs for current user's department
  const departmentMRNs = useMemo(() => {
    return mrns.filter(mrn => {
      const matchesSearch = mrn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          mrn.controlNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || mrn.status === statusFilter;
      const matchesDepartment = mrn.department === user?.department;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [mrns, searchQuery, statusFilter, user]);

  // Filter annual plans for current user's department
  const departmentPlans = useMemo(() => {
    return annualPlans.filter(plan => plan.department === user?.department);
  }, [annualPlans, user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500";
      case "Under Review": return "bg-blue-500";
      case "Converted to MRF": return "bg-green-500";
      case "Rejected": return "bg-red-500";
      case "Draft": return "bg-gray-500";
      case "Submitted": return "bg-blue-500";
      case "Approved": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const stats = {
    pending: departmentMRNs.filter(m => m.status === "Pending").length,
    underReview: departmentMRNs.filter(m => m.status === "Under Review").length,
    converted: departmentMRNs.filter(m => m.status === "Converted to MRF").length,
    rejected: departmentMRNs.filter(m => m.status === "Rejected").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department Dashboard</h1>
          <p className="text-muted-foreground">
            Submit material requests and track your department's procurement needs
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending MRNs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.underReview}</div>
              <p className="text-xs text-muted-foreground">Being processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Converted</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.converted}</div>
              <p className="text-xs text-muted-foreground">Now as MRFs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Need revision</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mrns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mrns">Material Request Notes</TabsTrigger>
            <TabsTrigger value="annual">Annual Planning</TabsTrigger>
          </TabsList>

          <TabsContent value="mrns" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Material Request Notes (MRN)</CardTitle>
                    <CardDescription>Submit requests for material procurement</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/department/mrn/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    New MRN
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by title or control number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Converted to MRF">Converted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* MRN List */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Control Number</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departmentMRNs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No MRNs found. Create your first material request note.
                          </TableCell>
                        </TableRow>
                      ) : (
                        departmentMRNs.map((mrn) => (
                          <TableRow key={mrn.id}>
                            <TableCell className="font-mono text-sm">{mrn.controlNumber}</TableCell>
                            <TableCell className="font-medium">{mrn.title}</TableCell>
                            <TableCell>{mrn.items.length} items</TableCell>
                            <TableCell>
                              <Badge variant={mrn.urgency === "High" ? "destructive" : "secondary"}>
                                {mrn.urgency}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(mrn.submittedDate), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(mrn.status)}>
                                {mrn.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/department/mrn/${mrn.id}`)}>
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="annual" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Annual Procurement Planning</CardTitle>
                    <CardDescription>Plan your department's material needs for the year</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/department/annual-plan/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Annual Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departmentPlans.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No annual plans submitted yet.</p>
                      <p className="text-sm">Create a plan to help reduce ad-hoc procurement requests.</p>
                    </div>
                  ) : (
                    departmentPlans.map((plan) => (
                      <Card key={plan.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">FY {plan.year} Plan</CardTitle>
                              <CardDescription>
                                {plan.items.length} items • ₦{parseFloat(plan.totalEstimatedBudget).toLocaleString()} budget
                              </CardDescription>
                            </div>
                            <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            Submitted: {format(new Date(plan.submittedDate), "MMM dd, yyyy")}
                          </div>
                          {plan.reviewNotes && (
                            <div className="mt-2 text-sm bg-muted p-2 rounded">
                              <strong>Review Notes:</strong> {plan.reviewNotes}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentDashboard;
