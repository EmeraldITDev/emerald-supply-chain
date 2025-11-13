import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, Package, ShoppingCart, Clock, CheckCircle2, XCircle, Download, Calendar, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { POGenerationDialog } from "@/components/POGenerationDialog";
import type { MRFRequest } from "@/contexts/AppContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Procurement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mrfRequests, srfRequests, purchaseOrders, approveMRF, rejectMRF, addPO, mrns, updateMRN, convertMRNToMRF, updateMRF } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [selectedMRFForPO, setSelectedMRFForPO] = useState<MRFRequest | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // Procurement Manager can upload PO for Executive-approved MRFs
  const executiveApprovedMRFs = useMemo(() => {
    return mrfRequests.filter(mrf => 
      (mrf.status === "Approved by Executive" || mrf.status === "Executive Approved") && 
      mrf.currentStage === "procurement" &&
      !mrf.unsignedPOUrl
    );
  }, [mrfRequests]);

  const vendorFromState = (location.state as any)?.vendor as string | undefined;
  const vendorFromQuery = searchParams.get("vendor") || undefined;
  const vendorFilter = vendorFromState || vendorFromQuery || undefined;

  const [tab, setTab] = useState<string>(vendorFilter ? "po" : "mrf");

  useEffect(() => {
    if (vendorFromState && !vendorFromQuery) {
      setSearchParams({ vendor: vendorFromState } as any, { replace: true } as any);
    }
  }, [vendorFromState]);

  useEffect(() => {
    if (vendorFilter) setTab("po");
  }, [vendorFilter]);

  // Stats
  const pendingMRNs = mrns.filter(mrn => mrn.status === "Pending" || mrn.status === "Under Review");
  const pendingPOUpload = executiveApprovedMRFs.length;
  const inSupplyChain = mrfRequests.filter(mrf => mrf.currentStage === "supply_chain").length;
  const totalPOs = purchaseOrders.length;

  // Filtered data
  const filteredMRFs = useMemo(() => {
    let filtered = [...mrfRequests];

    if (searchQuery) {
      filtered = filtered.filter(mrf =>
        mrf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrf.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrf.requester.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(mrf => {
        if (statusFilter === "pending") return mrf.currentStage === "procurement";
        if (statusFilter === "approved") return mrf.currentStage === "approved";
        if (statusFilter === "rejected") return mrf.currentStage === "rejected";
        if (statusFilter === "finance") return mrf.currentStage === "finance";
        if (statusFilter === "chairman") return mrf.currentStage === "chairman";
        return true;
      });
    }

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

    filtered.sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "amount-desc") return parseInt(b.estimatedCost) - parseInt(a.estimatedCost);
      if (sortBy === "amount-asc") return parseInt(a.estimatedCost) - parseInt(b.estimatedCost);
      return 0;
    });

    return filtered;
  }, [mrfRequests, searchQuery, statusFilter, dateFilter, sortBy]);

  const filteredPOs = purchaseOrders.filter((po) => !vendorFilter || po.vendor === vendorFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "Completed":
        return "bg-accent text-accent-foreground";
      case "Pending":
      case "Submitted":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Procurement Approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Finance Approved":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Rejected":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getApprovalTimerColor = (mrf: MRFRequest) => {
    if (!mrf.procurementManagerApprovalTime || mrf.currentStage === "approved" || mrf.currentStage === "rejected") {
      return null;
    }
    
    const startTime = new Date(mrf.procurementManagerApprovalTime);
    const now = new Date();
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursElapsed <= 48) return "text-emerald-600 dark:text-emerald-400";
    if (hoursElapsed <= 72) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const handleMRFClick = (mrf: MRFRequest) => {
    // Procurement can only view MRFs, not approve them
    toast({
      title: "View Only",
      description: "Procurement can view MRFs but cannot approve. Only Executive has approval authority.",
      variant: "default",
    });
  };

  // Procurement cannot approve/reject - only view
  const handleApprove = (remarks: string) => {
    toast({
      title: "Access Denied",
      description: "Only Executive can approve MRFs. You can view and generate POs.",
      variant: "destructive",
    });
  };

  const handleReject = (remarks: string) => {
    toast({
      title: "Access Denied",
      description: "Only Executive can reject MRFs. You can view and generate POs.",
      variant: "destructive",
    });
  };

  const handleGeneratePO = (mrf: MRFRequest) => {
    setSelectedMRFForPO(mrf);
    setPODialogOpen(true);
  };

  const handlePOGeneration = (poData: {
    vendor: string;
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
  }) => {
    if (!selectedMRFForPO) return;

    // Generate PO number
    const poNumber = `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, "0")}`;
    
    // Create the PO
    addPO({
      vendor: poData.vendor,
      items: poData.items,
      amount: poData.amount,
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      deliveryDate: poData.deliveryDate,
    });

    // Update MRF with PO details and route to Supply Chain
    updateMRF(selectedMRFForPO.id, {
      poNumber: poNumber,
      unsignedPOUrl: `uploads/po/${poNumber}.pdf`, // Placeholder URL
      currentStage: "supply_chain",
      status: "PO Generated - With Supply Chain"
    });

    toast({
      title: "Purchase Order Created",
      description: `${poNumber} generated and forwarded to Supply Chain Director`,
    });

    setPODialogOpen(false);
    setSelectedMRFForPO(null);
  };

  const handleConvertMRNToMRF = (mrnId: string) => {
    const mrn = mrns.find(m => m.id === mrnId);
    if (!mrn) return;

    convertMRNToMRF(mrnId, user?.name || "Procurement Manager");

    toast({
      title: "MRN Converted to MRF",
      description: `${mrn.controlNumber} has been converted to an official MRF`,
    });
  };

  const handleRejectMRN = (mrnId: string, reason: string) => {
    updateMRN(mrnId, {
      status: "Rejected",
      reviewedBy: user?.name || "Procurement Manager",
      reviewDate: new Date().toISOString(),
      reviewNotes: reason,
    });

    toast({
      title: "MRN Rejected",
      description: "The requester has been notified",
      variant: "destructive",
    });
  };

  const statusOptions = [
    { label: "All Requests", value: "all" },
    { label: "Pending My Review", value: "pending" },
    { label: "With Finance", value: "finance" },
    { label: "With Chairman", value: "chairman" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Procurement Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage material and service requests</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Pending PO Upload"
            value={pendingPOUpload}
            description="Executive approved, awaiting PO"
            icon={Clock}
            iconColor="text-warning"
            onClick={() => setTab("mrf")}
          />
          <StatCard
            title="Pending MRNs"
            value={pendingMRNs.length}
            description="Awaiting review"
            icon={FileText}
            iconColor="text-info"
            onClick={() => setTab("mrn")}
          />
          <StatCard
            title="In Supply Chain"
            value={inSupplyChain}
            description="With Supply Chain Director"
            icon={Package}
            iconColor="text-success"
          />
          <StatCard
            title="Total POs"
            value={totalPOs}
            description="Purchase orders"
            icon={ShoppingCart}
            iconColor="text-primary"
            onClick={() => setTab("po")}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto gap-1">
            <TabsTrigger value="mrn" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3 flex-col sm:flex-row gap-1">
              <span className="hidden sm:inline">Material Requests (MRN)</span>
              <span className="sm:hidden">MRN</span>
              {pendingMRNs.length > 0 && (
                <Badge variant="destructive" className="ml-0 sm:ml-2 text-[8px] sm:text-xs h-4 sm:h-5 px-1">
                  {pendingMRNs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mrf" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">MRF (Official)</span>
              <span className="sm:hidden">MRF</span>
            </TabsTrigger>
            <TabsTrigger value="srf" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">Service Requests</span>
              <span className="sm:hidden">SRF</span>
            </TabsTrigger>
            <TabsTrigger value="po" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-3">
              <span className="hidden sm:inline">Purchase Orders</span>
              <span className="sm:hidden">PO</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mrn" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Material Request Notes (MRN)</CardTitle>
                    <CardDescription>Review department requests and convert to official MRFs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mrns.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No material request notes submitted yet</p>
                    </div>
                  ) : (
                    mrns.map((mrn) => (
                      <Card key={mrn.id} className="overflow-hidden">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm font-semibold">{mrn.controlNumber}</span>
                                <Badge className={
                                  mrn.status === "Pending" ? "bg-yellow-500" :
                                  mrn.status === "Under Review" ? "bg-blue-500" :
                                  mrn.status === "Converted to MRF" ? "bg-green-500" :
                                  "bg-red-500"
                                }>
                                  {mrn.status}
                                </Badge>
                                <Badge variant={mrn.urgency === "High" ? "destructive" : "secondary"}>
                                  {mrn.urgency}
                                </Badge>
                              </div>
                              <h3 className="text-lg font-semibold">{mrn.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Requested by {mrn.requesterName} • {mrn.department} • {new Date(mrn.submittedDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div>
                              <strong className="text-sm">Justification:</strong>
                              <p className="text-sm text-muted-foreground">{mrn.justification}</p>
                            </div>

                            <div>
                              <strong className="text-sm">Items Requested ({mrn.items.length}):</strong>
                              <div className="mt-2 space-y-2">
                                {mrn.items.map((item, idx) => (
                                  <div key={idx} className="bg-muted p-3 rounded-md">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="font-medium">{item.name}</p>
                                        {item.description && (
                                          <p className="text-sm text-muted-foreground">{item.description}</p>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="text-sm">Qty: {item.quantity}</p>
                                        <p className="text-sm font-semibold">₦{parseFloat(item.estimatedUnitCost).toLocaleString()}/unit</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-primary/5 p-3 rounded-md">
                              <strong className="text-sm">Total Estimated Cost:</strong>
                              <p className="text-lg font-bold">
                                ₦{mrn.items.reduce((sum, item) => 
                                  sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.estimatedUnitCost) || 0), 0
                                ).toLocaleString()}
                              </p>
                            </div>

                            {mrn.reviewNotes && (
                              <div className="bg-muted p-3 rounded-md">
                                <strong className="text-sm">Review Notes:</strong>
                                <p className="text-sm text-muted-foreground mt-1">{mrn.reviewNotes}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Reviewed by {mrn.reviewedBy} on {mrn.reviewDate && new Date(mrn.reviewDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}

                            {mrn.convertedMRFId && (
                              <div className="bg-green-500/10 p-3 rounded-md">
                                <p className="text-sm text-green-700 dark:text-green-400">
                                  ✓ Converted to MRF: <span className="font-mono font-semibold">{mrn.convertedMRFId}</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {mrn.status === "Pending" || mrn.status === "Under Review" ? (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleConvertMRNToMRF(mrn.id)}
                                className="flex-1"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Convert to MRF
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  const reason = prompt("Enter rejection reason:");
                                  if (reason) handleRejectMRN(mrn.id, reason);
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mrf" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Material Request Forms</CardTitle>
                    <CardDescription>Review and approve material requisitions</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/procurement/mrf/new")} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New MRF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Executive Approved MRFs - Awaiting PO Upload */}
                {executiveApprovedMRFs.length > 0 && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">Action Required: Upload Purchase Orders</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {executiveApprovedMRFs.length} MRF(s) approved by Executive awaiting PO upload
                    </p>
                    <div className="space-y-3">
                      {executiveApprovedMRFs.map((mrf) => (
                        <Card key={mrf.id} className="bg-card">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">{mrf.title}</h4>
                                  <Badge variant="default">Exec Approved</Badge>
                                  {parseFloat(mrf.estimatedCost) > 1000000 && (
                                    <Badge variant="destructive">High Value</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>MRF ID: <span className="font-medium">{mrf.id}</span></p>
                                  <p>Requester: {mrf.requester}</p>
                                  <p>Amount: <span className="font-semibold">₦{parseInt(mrf.estimatedCost).toLocaleString()}</span></p>
                                  <p className="text-xs italic">Quantity: {mrf.quantity}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleGeneratePO(mrf)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Upload PO
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

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
                              <SelectItem value="amount-desc">Highest Amount</SelectItem>
                              <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    }
                  />

                  {/* Results */}
                  <div className="space-y-3 mt-4">
                    {filteredMRFs.map((request) => {
                      const timerColor = getApprovalTimerColor(request);
                      return (
                        <div
                          key={request.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                          onClick={() => handleMRFClick(request)}
                        >
                          <div className="flex items-start gap-4 min-w-0 flex-1">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Package className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{request.title}</h3>
                                {request.isResubmission && (
                                  <Badge variant="outline" className="text-xs">
                                    Resubmission
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-2">
                                <span className="font-medium">{request.id}</span>
                                <span>•</span>
                                <span>{request.requester}</span>
                                <span>•</span>
                                <span>{new Date(request.date).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="font-semibold text-foreground">₦{parseInt(request.estimatedCost).toLocaleString()}</span>
                              </div>
                              {request.currentStage && (
                                <p className="text-xs text-muted-foreground">
                                  Stage: <span className="capitalize font-medium">{request.currentStage}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start sm:self-center">
                            <div className="flex items-center gap-2">
                              {timerColor && <Clock className={`h-4 w-4 ${timerColor}`} />}
                              {request.currentStage === "approved" && <CheckCircle2 className="h-5 w-5 text-success" />}
                              {request.currentStage === "rejected" && <XCircle className="h-5 w-5 text-destructive" />}
                              <Badge className={getStatusColor(request.status)}>
                                {request.status}
                              </Badge>
                            </div>
                            {request.currentStage === "approved" && (
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeneratePO(request);
                                }}
                              >
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                Generate PO
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="srf" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Service Request Forms</CardTitle>
                    <CardDescription>List of all service requisition requests</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/procurement/srf/new")} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New SRF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {srfRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{request.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.id} • {request.requester} • {request.date}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="po" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>List of all purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-5 border rounded-xl hover:shadow-md transition-smooth bg-card cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <ShoppingCart className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{po.items}</p>
                          <p className="text-sm text-muted-foreground">
                            {po.id} • {po.vendor} • {po.date}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Delivery: {po.deliveryDate} • {po.amount}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(po.status)}>
                        {po.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <POGenerationDialog
        open={poDialogOpen}
        onOpenChange={setPODialogOpen}
        mrf={selectedMRFForPO}
        onGenerate={handlePOGeneration}
      />
    </DashboardLayout>
  );
};

export default Procurement;
