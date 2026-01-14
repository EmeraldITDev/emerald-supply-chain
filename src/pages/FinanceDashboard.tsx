import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Clock, Calendar, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { mrfApi } from "@/services/api";
import type { MRF } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { OneDriveLink } from "@/components/OneDriveLink";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const FinanceDashboard = () => {
  const { toast } = useToast();
  const [mrfRequests, setMrfRequests] = useState<MRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dateFilter, setDateFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Fetch MRFs from backend API
  const fetchMRFs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mrfApi.getAll();
      if (response.success && response.data) {
        setMrfRequests(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load MRFs",
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
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMRFs();
  }, [fetchMRFs]);

  // Helper functions
  const getEstimatedCost = (mrf: MRF) => {
    return parseFloat(String(mrf.estimated_cost || mrf.estimatedCost || "0"));
  };

  const getRequesterName = (mrf: MRF) => {
    return mrf.requester_name || mrf.requester || "Unknown";
  };

  const getDate = (mrf: MRF) => {
    return mrf.created_at || mrf.date || "";
  };

  const getCurrentStage = (mrf: MRF) => {
    return (mrf.current_stage || mrf.currentStage || "").toLowerCase();
  };

  // Filter for MRFs that have signed POs and are ready for payment
  const approvedMRFs = useMemo(() => {
    return mrfRequests.filter(mrf => {
      const stage = getCurrentStage(mrf);
      const status = (mrf.status || "").toLowerCase();
      return stage === "finance" || status.includes("finance");
    });
  }, [mrfRequests]);

  const pendingPayment = useMemo(() => {
    return approvedMRFs.filter(mrf => !processedItems.has(mrf.id));
  }, [approvedMRFs, processedItems]);

  const processed = useMemo(() => {
    return approvedMRFs.filter(mrf => processedItems.has(mrf.id));
  }, [approvedMRFs, processedItems]);

  // Calculate totals
  const totalPending = useMemo(() => {
    return pendingPayment.reduce((sum, mrf) => sum + getEstimatedCost(mrf), 0);
  }, [pendingPayment]);

  const totalProcessed = useMemo(() => {
    return processed.reduce((sum, mrf) => sum + getEstimatedCost(mrf), 0);
  }, [processed]);

  // Filtered data
  const filteredRequests = useMemo(() => {
    let filtered = statusFilter === "pending" ? pendingPayment : processed;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(mrf =>
        mrf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrf.requester.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(mrf => {
        const mrfDate = new Date(mrf.date);
        const daysDiff = (now.getTime() - mrfDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dateFilter === "today") return daysDiff < 1;
        if (dateFilter === "week") return daysDiff < 7;
        if (dateFilter === "month") return daysDiff < 30;
        return true;
      });
    }

    // Amount filter
    if (minAmount || maxAmount) {
      filtered = filtered.filter(mrf => {
        const amount = parseInt(mrf.estimatedCost);
        const min = minAmount ? parseInt(minAmount) : 0;
        const max = maxAmount ? parseInt(maxAmount) : Infinity;
        return amount >= min && amount <= max;
      });
    }

    return filtered;
  }, [pendingPayment, processed, statusFilter, searchQuery, dateFilter, minAmount, maxAmount]);

  const handleMarkProcessed = async (id: string) => {
    const mrf = mrfRequests.find(m => m.id === id);
    if (!mrf) return;
    
    setActionLoading(id);
    
    try {
      // Call the real backend API endpoint for processing payment
      const response = await mrfApi.processPayment(id);
      
      if (response.success) {
    setProcessedItems(prev => new Set([...prev, id]));
    
    toast({
      title: "Payment Forwarded",
      description: `${mrf.title} has been forwarded to Chairman for payment approval`,
    });
        
        // Refresh the list from backend
        await fetchMRFs();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to process payment",
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
      setActionLoading(null);
    }
  };

  const statusOptions = [
    { label: "Pending Payment", value: "pending" },
    { label: "Processed", value: "processed" },
  ];

  const activeFiltersCount = 
    (dateFilter !== "all" ? 1 : 0) + 
    (minAmount ? 1 : 0) + 
    (maxAmount ? 1 : 0);

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
          <p className="text-muted-foreground mt-1">Payment Processing & Financial Oversight</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Awaiting Processing"
          value={pendingPayment.length}
          description="Approved requests pending payment"
          icon={Clock}
          iconColor="text-warning"
          onClick={() => setStatusFilter("pending")}
        />
        <StatCard
          title="Total Pending Amount"
          value={`₦${totalPending.toLocaleString()}`}
          description="Total value to be processed"
          icon={DollarSign}
          iconColor="text-info"
        />
        <StatCard
          title="Processed Payments"
          value={processed.length}
          description="Payments completed"
          icon={CheckCircle}
          iconColor="text-success"
          onClick={() => setStatusFilter("processed")}
        />
        <StatCard
          title="Total Processed"
          value={`₦${totalProcessed.toLocaleString()}`}
          description="Total value processed"
          icon={TrendingUp}
          iconColor="text-primary"
        />
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Payment Queue</CardTitle>
              <CardDescription>Review and process approved payment requests</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusOptions={statusOptions}
              placeholder="Search by title, ID, or requester..."
              activeFiltersCount={activeFiltersCount}
              onClearFilters={() => {
                setDateFilter("all");
                setMinAmount("");
                setMaxAmount("");
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
                    <label className="text-sm font-medium mb-2 block">Amount Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Min ₦"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Max ₦"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              }
            />

            {/* Results */}
            <div className="space-y-3 mt-6">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No requests found</p>
                  <p className="text-sm mt-1">
                    {statusFilter === "pending" ? "All payments are up to date" : "No processed payments yet"}
                  </p>
                </div>
              ) : (
                filteredRequests.map((mrf) => {
                  const isProcessed = processedItems.has(mrf.id);
                  
                  return (
                    <div
                      key={mrf.id}
                      className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 border rounded-xl transition-smooth ${
                        isProcessed ? "bg-muted/30" : "bg-card hover:shadow-md"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{mrf.title}</h3>
                          <Badge variant="outline">{mrf.id}</Badge>
                          {isProcessed && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              Processed
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Requester</p>
                            <p className="font-medium">{mrf.requester}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Category</p>
                            <p className="font-medium capitalize">{mrf.category.replace("-", " ")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Amount</p>
                            <p className="font-bold text-lg">₦{parseInt(mrf.estimatedCost).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Date</p>
                            <p className="font-medium">{new Date(mrf.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{mrf.description}</p>
                      </div>
                      {!isProcessed && (
                        <div className="flex gap-2 self-start lg:self-center items-center flex-wrap">
                          {(mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl) && (
                            <OneDriveLink 
                              webUrl={mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl} 
                              fileName={`Signed PO-${mrf.po_number || mrf.poNumber || 'N/A'}.pdf`}
                              variant="badge"
                            />
                          )}
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" />
                            Documents
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleMarkProcessed(mrf.id)}
                            className="gradient-primary hover:opacity-90"
                            disabled={actionLoading === mrf.id}
                          >
                            {actionLoading === mrf.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark as Processed
                              </>
                            )}
                          </Button>
                        </div>
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
    </DashboardLayout>
  );
};

export default FinanceDashboard;
