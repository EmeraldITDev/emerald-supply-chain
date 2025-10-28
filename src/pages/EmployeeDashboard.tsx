import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, CheckCircle, XCircle, Clock, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EmployeeDashboard = () => {
  const { mrfRequests, srfRequests } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Filter to show only current user's requests
  const myMRFs = mrfRequests.filter(mrf => mrf.requester === user?.name || mrf.requester === "Current User");
  const mySRFs = srfRequests.filter(srf => srf.requester === user?.name || srf.requester === "Current User");

  const pendingMRFs = myMRFs.filter(mrf => mrf.status === "Submitted" || mrf.status.includes("Pending") || (mrf.status.includes("Approved") && mrf.currentStage !== "approved"));
  const approvedMRFs = myMRFs.filter(mrf => mrf.status === "Approved" && mrf.currentStage === "approved");
  const rejectedMRFs = myMRFs.filter(mrf => mrf.status === "Rejected");

  // Filtering and sorting logic
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...myMRFs, ...mySRFs];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(req =>
        req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(req => {
        if (statusFilter === "pending") return req.status === "Submitted" || req.status.includes("Pending") || req.status.includes("Approved");
        if (statusFilter === "approved") return req.status === "Approved" && (req as any).currentStage === "approved";
        if (statusFilter === "rejected") return req.status === "Rejected";
        if (statusFilter === "completed") return req.status === "Completed";
        return true;
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(req => {
        const reqDate = new Date(req.date);
        const daysDiff = (now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dateFilter === "today") return daysDiff < 1;
        if (dateFilter === "week") return daysDiff < 7;
        if (dateFilter === "month") return daysDiff < 30;
        return true;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return filtered;
  }, [myMRFs, mySRFs, searchQuery, statusFilter, dateFilter, sortBy]);

  const statusOptions = [
    { label: "All Requests", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "Completed", value: "completed" },
  ];

  const getStatusBadge = (status: string, currentStage?: string) => {
    if (status === "Approved" && currentStage === "approved") {
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Approved</Badge>;
    }
    if (status === "Rejected") {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    if (status === "Completed") {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Completed</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/new-mrf")} size="lg" className="gradient-primary hover:opacity-90 transition-smooth">
            <Plus className="mr-2 h-5 w-5" />
            New MRF
          </Button>
          <Button onClick={() => navigate("/new-srf")} variant="outline" size="lg">
            <Plus className="mr-2 h-5 w-5" />
            New SRF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Pending Requests"
          value={pendingMRFs.length}
          description="Awaiting approval"
          icon={Clock}
          iconColor="text-warning"
          onClick={() => setStatusFilter("pending")}
        />
        <StatCard
          title="Approved"
          value={approvedMRFs.length}
          description="Successfully approved"
          icon={CheckCircle}
          iconColor="text-success"
          onClick={() => setStatusFilter("approved")}
        />
        <StatCard
          title="Rejected"
          value={rejectedMRFs.length}
          description="Needs revision"
          icon={XCircle}
          iconColor="text-destructive"
          onClick={() => setStatusFilter("rejected")}
        />
        <StatCard
          title="Total Requests"
          value={myMRFs.length + mySRFs.length}
          description="All time"
          icon={TrendingUp}
          iconColor="text-info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>View and track your submitted requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusOptions={statusOptions}
              placeholder="Search by title, ID, or description..."
              activeFiltersCount={activeFiltersCount}
              onClearFilters={() => {
                setStatusFilter("all");
                setDateFilter("all");
              }}
              additionalFilters={
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date Range</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Newest First</SelectItem>
                        <SelectItem value="date-asc">Oldest First</SelectItem>
                        <SelectItem value="title">Title (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              }
            />

            {/* Results */}
            <div className="space-y-3 mt-6">
              {filteredAndSortedRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No requests found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Create your first MRF or SRF to get started"}
                  </p>
                </div>
              ) : (
                filteredAndSortedRequests.map((request) => {
                  const isMRF = "category" in request;
                  const mrf = isMRF ? request as any : null;
                  
                  return (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 border rounded-xl hover:shadow-md transition-smooth bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{request.title}</h3>
                          {getStatusBadge(request.status, mrf?.currentStage)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-2">
                          <span className="font-medium">{request.id}</span>
                          <span>•</span>
                          <span>{new Date(request.date).toLocaleDateString()}</span>
                          {isMRF && mrf.estimatedCost && (
                            <>
                              <span>•</span>
                              <span className="font-medium">₦{parseInt(mrf.estimatedCost).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
                        {mrf?.rejectionReason && (
                          <p className="text-sm text-destructive mt-2 p-2 bg-destructive/10 rounded">
                            <strong>Rejection reason:</strong> {mrf.rejectionReason}
                          </p>
                        )}
                      </div>
                      {request.status === "Rejected" && (
                        <Button
                          onClick={() => navigate("/new-mrf", { state: { rejectedMRF: request } })}
                          className="self-start sm:self-center"
                        >
                          Edit & Resubmit
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
