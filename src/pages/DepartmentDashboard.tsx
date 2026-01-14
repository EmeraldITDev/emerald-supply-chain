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
  const { mrns, annualPlans, mrfRequests, srfRequests, refreshMRFs } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mrfToDelete, setMrfToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter MRNs for current user only (employees see only their own requests)
  const departmentMRNs = useMemo(() => {
    return mrns.filter(mrn => {
      const matchesSearch = mrn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          mrn.controlNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || mrn.status === statusFilter;
      // Employees only see their own MRNs
      const matchesUser = mrn.requesterId === user?.email || mrn.requesterName === user?.name;
      
      return matchesSearch && matchesStatus && matchesUser;
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

  const handleDeleteMRF = async (mrfId: string) => {
    setMrfToDelete(mrfId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteMRF = async () => {
    if (!mrfToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await mrfApi.delete(mrfToDelete);
      if (response.success) {
        toast({
          title: "MRF Deleted",
          description: "The Material Request Form has been deleted successfully",
        });
        if (refreshMRFs) {
          await refreshMRFs();
        }
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete MRF",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setMrfToDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">
            Submit material requests and track your procurement activities
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">In Review</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.underReview}</div>
              <p className="text-xs text-muted-foreground">Processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Converted</CardTitle>
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.converted}</div>
              <p className="text-xs text-muted-foreground">To MRFs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 lg:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Revision</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mrns" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mrns">Material Request Notes</TabsTrigger>
            <TabsTrigger value="mrf">Material Request Forms (MRF)</TabsTrigger>
            <TabsTrigger value="srf">Service Request Forms (SRF)</TabsTrigger>
            <TabsTrigger value="annual">Annual Planning</TabsTrigger>
          </TabsList>

          <TabsContent value="mrns" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Material Request Notes (MRN)</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Submit requests for material procurement</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/department/mrn/new")} size="sm" className="sm:size-default">
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">New MRN</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
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
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Control #</TableHead>
                        <TableHead className="text-xs sm:text-sm">Title</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Items</TableHead>
                        <TableHead className="text-xs sm:text-sm">Urgency</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Submitted</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Actions</TableHead>
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
                            <TableCell className="font-mono text-xs sm:text-sm">{mrn.controlNumber}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm max-w-[150px] sm:max-w-none truncate">{mrn.title}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">{mrn.items.length} items</TableCell>
                            <TableCell>
                              <Badge variant={mrn.urgency === "High" ? "destructive" : "secondary"} className="text-xs">
                                {mrn.urgency}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{format(new Date(mrn.submittedDate), "MMM dd, yyyy")}</TableCell>
                            <TableCell>
                              <Badge className={`${getStatusColor(mrn.status)} text-xs`}>
                                {mrn.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/department/mrn/${mrn.id}`)} className="text-xs sm:text-sm">
                                <span className="hidden sm:inline">View Details</span>
                                <span className="sm:hidden">View</span>
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

          {/* MRF Tab - Only for employees */}
          <TabsContent value="mrf" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Material Request Forms (MRF)</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Official material requisition forms</CardDescription>
                  </div>
                  {user?.role === "employee" && (
                    <Button onClick={() => navigate("/new-mrf")} size="sm" className="sm:size-default">
                      <Plus className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">New MRF</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-3">
                  {mrfRequests.filter(mrf => mrf.requesterId === user?.email || mrf.requester === user?.name).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No MRFs found.</p>
                      {user?.role === "employee" && (
                        <p className="text-sm mt-1">Create your first Material Request Form.</p>
                      )}
                    </div>
                  ) : (
                    mrfRequests
                      .filter(mrf => mrf.requesterId === user?.email || mrf.requester === user?.name)
                      .map((mrf) => {
                        // Only allow delete for pending or rejected MRFs (not in workflow)
                        const canDelete = (mrf.status || "").toLowerCase() === "pending" || 
                                         (mrf.status || "").toLowerCase().includes("rejected");
                        return (
                          <Card key={mrf.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold">{mrf.title}</h3>
                                  <p className="text-sm text-muted-foreground">MRF ID: {mrf.id}</p>
                                  <p className="text-sm text-muted-foreground">Status: {mrf.status}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(mrf.status)}>{mrf.status}</Badge>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteMRF(mrf.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SRF Tab - Only for employees */}
          <TabsContent value="srf" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Service Request Forms (SRF)</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Official service requisition forms</CardDescription>
                  </div>
                  {user?.role === "employee" && (
                    <Button onClick={() => navigate("/new-srf")} size="sm" className="sm:size-default">
                      <Plus className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">New SRF</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-3">
                  {srfRequests.filter(srf => srf.requesterId === user?.email || srf.requester === user?.name).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No SRFs found.</p>
                      {user?.role === "employee" && (
                        <p className="text-sm mt-1">Create your first Service Request Form.</p>
                      )}
                    </div>
                  ) : (
                    srfRequests
                      .filter(srf => srf.requesterId === user?.email || srf.requester === user?.name)
                      .map((srf) => (
                        <Card key={srf.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{srf.title}</h3>
                                <p className="text-sm text-muted-foreground">SRF ID: {srf.id}</p>
                                <p className="text-sm text-muted-foreground">Status: {srf.status}</p>
                              </div>
                              <Badge className={getStatusColor(srf.status)}>{srf.status}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="annual" className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Annual Procurement Planning</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Plan your department's material needs for the year</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/department/annual-plan/new")} size="sm" className="sm:size-default">
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">New Annual Plan</span>
                    <span className="sm:hidden">New Plan</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete MRF Request?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this Material Request Form? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteMRF}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default DepartmentDashboard;
