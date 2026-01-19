import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Clock, Calendar, DollarSign, TrendingUp, Loader2, FileText } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { mrfApi, grnApi, dashboardApi } from "@/services/api";
import type { MRF } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { OneDriveLink } from "@/components/OneDriveLink";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import GRNRequestDialog from "@/components/GRNRequestDialog";
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
  const [financeMRFs, setFinanceMRFs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set());
  const [grnRequestDialogOpen, setGrnRequestDialogOpen] = useState(false);
  const [selectedMRF, setSelectedMRF] = useState<MRF | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [dateFilter, setDateFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Fetch Finance Dashboard data from backend API
  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dashboardApi.getFinanceDashboard();
      if (response.success && response.data) {
        setFinanceMRFs(response.data.financeMRFs || []);
        setStats(response.data.stats || null);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to load finance data",
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
    fetchFinanceData();
  }, [fetchFinanceData]);

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

  // Get workflow state helper
  const getWorkflowState = (mrf: MRF) => {
    return (mrf.workflow_state || mrf.workflowState || "").toLowerCase();
  };

  // Filter finance MRFs based on status
  const pendingPayment = useMemo(() => {
    return financeMRFs.filter((item: any) => {
      const mrf = item.mrf || item;
      const workflowState = getWorkflowState(mrf);
      return (workflowState === "po_signed" || workflowState === "payment_pending") && 
             !processedItems.has(mrf.id);
    });
  }, [financeMRFs, processedItems]);

  const processed = useMemo(() => {
    return financeMRFs.filter((item: any) => {
      const mrf = item.mrf || item;
      return processedItems.has(mrf.id);
    });
  }, [financeMRFs, processedItems]);

  const processedForGRN = useMemo(() => {
    return financeMRFs.filter((item: any) => {
      const mrf = item.mrf || item;
      const workflowState = getWorkflowState(mrf);
      const grnRequested = mrf.grn_requested || mrf.grnRequested;
      return workflowState === "payment_processed" && !grnRequested;
    });
  }, [financeMRFs]);

  // Use stats from API if available, otherwise calculate
  const totalPending = useMemo(() => {
    if (stats?.totalPendingAmount) return stats.totalPendingAmount;
    return pendingPayment.reduce((sum, item: any) => {
      const mrf = item.mrf || item;
      const quotation = item.quotation;
      const amount = quotation?.price || quotation?.total_amount || getEstimatedCost(mrf);
      return sum + (typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0);
    }, 0);
  }, [stats, pendingPayment]);

  const totalProcessed = useMemo(() => {
    if (stats?.totalProcessedAmount) return stats.totalProcessedAmount;
    return processed.reduce((sum, item: any) => {
      const mrf = item.mrf || item;
      const quotation = item.quotation;
      const amount = quotation?.price || quotation?.total_amount || getEstimatedCost(mrf);
      return sum + (typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0);
    }, 0);
  }, [stats, processed]);

  // Filtered data
  const filteredRequests = useMemo(() => {
    let filtered;
    if (statusFilter === "pending") {
      filtered = pendingPayment;
    } else if (statusFilter === "grn_ready") {
      filtered = processedForGRN;
    } else {
      filtered = processed;
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((item: any) => {
        const mrf = item.mrf || item;
        const vendor = item.vendor || {};
        return (
          mrf.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          mrf.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          getRequesterName(mrf).toLowerCase().includes(searchQuery.toLowerCase()) ||
          vendor.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((item: any) => {
        const mrf = item.mrf || item;
        const mrfDate = new Date(getDate(mrf));
        const daysDiff = (now.getTime() - mrfDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dateFilter === "today") return daysDiff < 1;
        if (dateFilter === "week") return daysDiff < 7;
        if (dateFilter === "month") return daysDiff < 30;
        return true;
      });
    }

    // Amount filter
    if (minAmount || maxAmount) {
      filtered = filtered.filter((item: any) => {
        const quotation = item.quotation;
        const amount = quotation?.price || quotation?.total_amount || 0;
        const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
        const min = minAmount ? parseFloat(minAmount) : 0;
        const max = maxAmount ? parseFloat(maxAmount) : Infinity;
        return numAmount >= min && numAmount <= max;
      });
    }

    return filtered;
  }, [pendingPayment, processed, processedForGRN, statusFilter, searchQuery, dateFilter, minAmount, maxAmount]);

  const handleMarkProcessed = async (id: string) => {
    const item = financeMRFs.find((item: any) => {
      const mrf = item.mrf || item;
      return mrf.id === id;
    });
    if (!item) return;
    const mrf = item.mrf || item;
    
    // Check available actions from backend before proceeding
    try {
      const response = await mrfApi.getAvailableActions(id);
      if (response.success && response.data) {
        if (!response.data.canProcessPayment) {
          toast({
            title: "Action Not Allowed",
            description: "You do not have permission to process payment for this MRF at this time.",
            variant: "destructive",
          });
          return;
        }
      } else {
        toast({
          title: "Error",
          description: "Could not verify permissions. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check permissions. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
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
        await fetchFinanceData();
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

  const handleRequestGRN = async (mrf: MRF) => {
    // Check available actions from backend before proceeding
    try {
      const response = await mrfApi.getAvailableActions(mrf.id);
      if (response.success && response.data) {
        if (!response.data.canRequestGRN) {
          toast({
            title: "Action Not Allowed",
            description: "You do not have permission to request GRN for this MRF at this time.",
            variant: "destructive",
          });
          return;
        }
      } else {
        toast({
          title: "Error",
          description: "Could not verify permissions. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check permissions. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setSelectedMRF(mrf);
    setGrnRequestDialogOpen(true);
  };

  const handleGRNRequestSuccess = () => {
    fetchFinanceData();
  };

  const statusOptions = [
    { label: "Pending Payment", value: "pending" },
    { label: "Processed", value: "processed" },
    { label: "Ready for GRN", value: "grn_ready" },
  ];

  const activeFiltersCount = 
    (dateFilter !== "all" ? 1 : 0) + 
    (minAmount ? 1 : 0) + 
    (maxAmount ? 1 : 0);

  return (
    <DashboardLayout>
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
          <p className="text-muted-foreground mt-1">Payment Processing & Financial Oversight</p>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Finance MRFs"
            value={stats.totalFinanceMRFs || financeMRFs.length || 0}
            description="All MRFs in finance stage"
            icon={FileText}
            iconColor="text-primary"
          />
          <StatCard
            title="Pending Payments"
            value={stats.pendingPayments || pendingPayment.length || 0}
            description={stats.totalPendingAmount ? `₦${stats.totalPendingAmount.toLocaleString()} total` : "No pending payments"}
            icon={Clock}
            iconColor="text-warning"
            onClick={() => setStatusFilter("pending")}
          />
          <StatCard
            title="Processed Payments"
            value={stats.processedPayments || processed.length || 0}
            description={stats.totalProcessedAmount ? `₦${stats.totalProcessedAmount.toLocaleString()} total` : "No processed payments"}
            icon={CheckCircle}
            iconColor="text-success"
            onClick={() => setStatusFilter("processed")}
          />
          <StatCard
            title="Approved Payments"
            value={stats.approvedPayments || 0}
            description={stats.totalApprovedAmount ? `₦${stats.totalApprovedAmount.toLocaleString()} total` : "No approved payments"}
            icon={TrendingUp}
            iconColor="text-primary"
          />
        </div>
      )}

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
                filteredRequests.map((item: any) => {
                  const mrf = item.mrf || item;
                  const vendor = item.vendor || {};
                  const quotation = item.quotation || {};
                  const po = item.po || {};
                  const isProcessed = processedItems.has(mrf.id);
                  const quotationAmount = quotation?.price || quotation?.total_amount || getEstimatedCost(mrf);
                  const executiveApproved = mrf.executive_approved || mrf.executiveApproved;
                  
                  return (
                    <div
                      key={mrf.id}
                      className={`flex flex-col gap-4 p-5 border rounded-xl transition-smooth mb-4 ${
                        isProcessed ? "bg-muted/30" : "bg-card hover:shadow-md"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="font-semibold text-lg">{mrf.title}</h3>
                          <Badge variant="outline">{mrf.id}</Badge>
                          {executiveApproved && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Executive Approved
                            </Badge>
                          )}
                          {isProcessed && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              Processed
                            </Badge>
                          )}
                        </div>
                        
                        {/* MRF Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Category</p>
                            <p className="font-medium capitalize">{mrf.category?.replace("-", " ") || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Contract Type</p>
                            <p className="font-medium">{mrf.contract_type || mrf.contractType || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Estimated Cost</p>
                            <p className="font-medium">₦{getEstimatedCost(mrf).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Date</p>
                            <p className="font-medium">{(() => {
                              const dateStr = getDate(mrf);
                              if (!dateStr) return 'N/A';
                              try {
                                const date = new Date(dateStr.includes('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/) ? dateStr : (dateStr.includes('T') ? dateStr + 'Z' : dateStr));
                                return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true
                                });
                              } catch {
                                return 'Invalid Date';
                              }
                            })()}</p>
                          </div>
                        </div>

                        {/* Vendor Information */}
                        {vendor && Object.keys(vendor).length > 0 && vendor.name && (
                          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Vendor Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {vendor.name && (
                                <div>
                                  <span className="text-muted-foreground">Name: </span>
                                  <span className="font-medium">{vendor.name}</span>
                                </div>
                              )}
                              {vendor.email && (
                                <div>
                                  <span className="text-muted-foreground">Email: </span>
                                  <span className="font-medium">{vendor.email}</span>
                                </div>
                              )}
                              {vendor.phone && (
                                <div>
                                  <span className="text-muted-foreground">Phone: </span>
                                  <span className="font-medium">{vendor.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Quotation Details */}
                        {quotation && Object.keys(quotation).length > 0 && (quotation.price || quotation.total_amount) && (
                          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">Quotation Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                              {(quotation.price || quotation.total_amount) && (
                                <div>
                                  <span className="text-muted-foreground">Total Amount: </span>
                                  <span className="font-bold text-lg">₦{typeof quotationAmount === 'number' ? quotationAmount.toLocaleString() : parseFloat(String(quotationAmount)).toLocaleString()}</span>
                                </div>
                              )}
                              {quotation.payment_terms && (
                                <div>
                                  <span className="text-muted-foreground">Payment Terms: </span>
                                  <span className="font-medium">{quotation.payment_terms}</span>
                                </div>
                              )}
                              {quotation.delivery_date && (
                                <div>
                                  <span className="text-muted-foreground">Delivery Date: </span>
                                  <span className="font-medium">{quotation.delivery_date}</span>
                                </div>
                              )}
                              {quotation.validity_days && (
                                <div>
                                  <span className="text-muted-foreground">Validity: </span>
                                  <span className="font-medium">{quotation.validity_days} days</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* PO Information */}
                        {po && Object.keys(po).length > 0 && (po.po_number || po.signed_po_url) && (
                          <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">Purchase Order</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {po.po_number && (
                                <div>
                                  <span className="text-muted-foreground">PO Number: </span>
                                  <span className="font-mono font-medium">{po.po_number}</span>
                                </div>
                              )}
                              {(po.signed_po_url || po.signed_po_share_url) && (
                                <div>
                                  <span className="text-muted-foreground">Signed PO: </span>
                                  <OneDriveLink 
                                    webUrl={po.signed_po_url || po.signed_po_share_url} 
                                    fileName={`Signed PO-${po.po_number || 'N/A'}.pdf`}
                                    variant="badge"
                                  />
                                </div>
                              )}
                              {po.po_signed_date && (
                                <div>
                                  <span className="text-muted-foreground">PO Signed Date: </span>
                                  <span className="font-medium">{new Date(po.po_signed_date).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground mt-2">{mrf.description}</p>
                      </div>
                      
                      <div className="flex gap-2 items-center flex-wrap border-t pt-4">
                        {(mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl || po?.signed_po_url) && (
                          <OneDriveLink 
                            webUrl={mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl || po?.signed_po_url} 
                            fileName={`Signed PO-${mrf.po_number || mrf.poNumber || po?.po_number || 'N/A'}.pdf`}
                            variant="badge"
                          />
                        )}
                        {!isProcessed && (
                          <>
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
                          </>
                        )}
                        {statusFilter === "grn_ready" && !(mrf.grn_requested || mrf.grnRequested) && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => handleRequestGRN(mrf)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Request GRN
                          </Button>
                        )}
                        {(mrf.grn_share_url || mrf.grnShareUrl) && (
                          <OneDriveLink 
                            webUrl={mrf.grn_share_url || mrf.grnShareUrl || mrf.grn_url || mrf.grnUrl} 
                            fileName={`GRN-${mrf.po_number || mrf.poNumber || 'N/A'}.pdf`}
                            variant="badge"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GRN Request Dialog */}
      {selectedMRF && (
        <GRNRequestDialog
          open={grnRequestDialogOpen}
          onOpenChange={setGrnRequestDialogOpen}
          mrf={selectedMRF}
          onSuccess={handleGRNRequestSuccess}
        />
      )}
    </div>
    </DashboardLayout>
  );
};

export default FinanceDashboard;
