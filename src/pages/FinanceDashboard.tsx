import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Clock, Calendar, DollarSign, TrendingUp, Loader2, FileText, CheckCircle } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { dashboardApi } from "@/services/api";
import type { MRF } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { OneDriveLink } from "@/components/OneDriveLink";
import { displayString, formatAmount } from "@/utils/normalizeQuotation";
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
  const [financeMRFs, setFinanceMRFs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  // Filtered data
  const filteredRequests = useMemo(() => {
    let filtered = [...financeMRFs];

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
        const q = item.quotation ?? item;
        const rawAmount = q.totalAmount ?? q.total_amount ?? q.total_order_value ?? q.totalOrderValue ?? q.price;
        const numAmount = rawAmount != null && rawAmount !== '' ? Number(rawAmount) : 0;
        const min = minAmount ? parseFloat(minAmount) : 0;
        const max = maxAmount ? parseFloat(maxAmount) : Infinity;
        return numAmount >= min && numAmount <= max;
      });
    }

    return filtered;
  }, [financeMRFs, searchQuery, dateFilter, minAmount, maxAmount]);

  const statusOptions = [
    { label: "All", value: "all" },
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
          <p className="text-muted-foreground mt-1">Financial overview — MRF approvals are handled in the Accounts Payable platform</p>
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
            value={stats.pendingPayments || 0}
            description={stats.totalPendingAmount ? `₦${stats.totalPendingAmount.toLocaleString()} total` : "No pending payments"}
            icon={Clock}
            iconColor="text-warning"
          />
          <StatCard
            title="Processed Payments"
            value={stats.processedPayments || 0}
            description={stats.totalProcessedAmount ? `₦${stats.totalProcessedAmount.toLocaleString()} total` : "No processed payments"}
            icon={CheckCircle}
            iconColor="text-success"
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

      {/* Read-only MRF list */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Finance MRF Overview</CardTitle>
              <CardDescription>Read-only view of MRFs at the finance stage. Payment processing is handled in Accounts Payable.</CardDescription>
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
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No requests found</p>
                  <p className="text-sm mt-1">No finance MRFs to display</p>
                </div>
              ) : (
                filteredRequests.map((item: any) => {
                  const mrf = item.mrf || item;
                  const vendor = item.vendor || {};
                  const q = item.quotation ?? item;
                  const quotation = item.quotation ?? {};
                  const po = item.po || {};
                  const rawAmount = q.totalAmount ?? q.total_amount ?? q.total_order_value ?? q.totalOrderValue ?? q.price;
                  const quotationAmount = rawAmount != null && rawAmount !== '' ? Number(rawAmount) : null;
                  const hasQuotationAmount = quotationAmount !== null && !Number.isNaN(quotationAmount);
                  const executiveApproved = mrf.executive_approved || mrf.executiveApproved;
                  
                  return (
                    <div
                      key={mrf.id}
                      className="flex flex-col gap-4 p-5 border rounded-xl bg-card hover:shadow-md transition-shadow mb-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="font-semibold text-lg">{mrf.title}</h3>
                          <Badge variant="outline">{mrf.id}</Badge>
                          {executiveApproved && (
                            <Badge className="bg-success/10 text-success border-success/20">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Executive Approved
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
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold mb-2">Vendor Information</p>
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
                            </div>
                          </div>
                        )}

                        {/* Quotation Details */}
                        {hasQuotationAmount && (
                          <div className="bg-success/5 border border-success/20 rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold mb-2">Quotation Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total Amount: </span>
                                <span className="font-bold text-lg">{formatAmount(quotationAmount, q.currency ?? q.currency_code ?? 'NGN')}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Payment Terms: </span>
                                <span className="font-medium">{displayString(quotation.payment_terms)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PO Information */}
                        {po && Object.keys(po).length > 0 && (po.po_number || po.signed_po_url) && (
                          <div className="bg-accent/50 border border-border rounded-lg p-3 mb-4">
                            <p className="text-sm font-semibold mb-2">Purchase Order</p>
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
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground mt-2">{mrf.description}</p>
                      </div>
                      
                      {/* Read-only actions — document links only */}
                      <div className="flex gap-2 items-center flex-wrap border-t pt-4">
                        {(mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl || po?.signed_po_url) && (
                          <OneDriveLink 
                            webUrl={mrf.signed_po_share_url || mrf.signedPOShareUrl || mrf.signed_po_url || mrf.signedPOUrl || po?.signed_po_url} 
                            fileName={`Signed PO-${mrf.po_number || mrf.poNumber || po?.po_number || 'N/A'}.pdf`}
                            variant="badge"
                          />
                        )}
                        {(mrf.grn_share_url || mrf.grnShareUrl) && (
                          <OneDriveLink 
                            webUrl={mrf.grn_share_url || mrf.grnShareUrl || mrf.grn_url || mrf.grnUrl} 
                            fileName={`GRN-${mrf.po_number || mrf.poNumber || 'N/A'}.pdf`}
                            variant="badge"
                          />
                        )}
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          Documents
                        </Button>
                      </div>
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
