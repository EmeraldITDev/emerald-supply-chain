import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Star, TrendingUp, Clock, CheckCircle, AlertCircle, Users, FileText, Award, X, Filter, Loader2 } from "lucide-react";
import { vendorApi, rfqApi, quotationApi } from "@/services/api";
import type { MRFRequest, RFQ, Quotation } from "@/contexts/AppContext";

interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  orders: number;
  status: string;
  kyc: string;
  email?: string;
}

interface RFQManagementProps {
  onVendorSelected?: (vendorId: string, rfqId: string) => void;
}

export const RFQManagement = ({ onVendorSelected }: RFQManagementProps) => {
  const { toast } = useToast();
  const { mrfRequests, rfqs, quotations } = useApp();
  
  // Fetch vendors from API instead of context
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [isCreatingRFQ, setIsCreatingRFQ] = useState(false);
  const [isAwardingVendor, setIsAwardingVendor] = useState(false);
  
  useEffect(() => {
    const fetchVendors = async () => {
      setLoadingVendors(true);
      try {
        const response = await vendorApi.getAll();
        if (response.success && response.data) {
          const transformedVendors = response.data.map((vendor: any) => ({
            id: vendor.id,
            name: vendor.name || vendor.company_name,
            category: vendor.category || 'Unknown',
            status: vendor.status || 'Active',
            kyc: vendor.kyc_status || 'Verified',
            rating: vendor.rating || 0,
            orders: vendor.total_orders || 0,
            email: vendor.email || '',
          }));
          setVendors(transformedVendors);
        }
      } catch (error) {
        console.error('Failed to fetch vendors:', error);
        toast({
          title: "Error",
          description: "Failed to load vendors",
          variant: "destructive",
        });
      } finally {
        setLoadingVendors(false);
      }
    };
    
    fetchVendors();
  }, [toast]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [rfqDetailsDialogOpen, setRfqDetailsDialogOpen] = useState(false);
  const [quotationDetailsDialogOpen, setQuotationDetailsDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [selectedMRF, setSelectedMRF] = useState<MRFRequest | null>(null);
  const [enhancedQuotationData, setEnhancedQuotationData] = useState<any | null>(null);
  const [loadingQuotationDetails, setLoadingQuotationDetails] = useState(false);
  const [rfqDetailsQuotations, setRfqDetailsQuotations] = useState<any[]>([]);
  const [loadingRfqDetails, setLoadingRfqDetails] = useState(false);
  const [rfqDetailsData, setRfqDetailsData] = useState<any | null>(null);

  // RFQ Creation form state
  const [selectionMethod, setSelectionMethod] = useState<'all_category' | 'manual' | 'preferred'>('manual');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [technicalReqs, setTechnicalReqs] = useState('');
  const [minRating, setMinRating] = useState(0);

  // Get approved MRFs that don't have an active RFQ
  const eligibleMRFs = useMemo(() => {
    const rfqMrfIds = rfqs.map(r => r.mrfId);
    return mrfRequests.filter(m => 
      (m.status.includes('Approved') || m.currentStage === 'procurement') &&
      !rfqMrfIds.includes(m.id)
    );
  }, [mrfRequests, rfqs]);

  // Get active vendors sorted by performance
  const activeVendors = useMemo(() => {
    return vendors
      .filter(v => v.status === 'Active' && v.kyc === 'Verified')
      .sort((a, b) => {
        // Calculate composite score
        const scoreA = (a.rating * 0.4) + ((a.orders / 100) * 0.3) + 0.3;
        const scoreB = (b.rating * 0.4) + ((b.orders / 100) * 0.3) + 0.3;
        return scoreB - scoreA;
      });
  }, [vendors]);

  // Filter vendors by category or other criteria
  const filteredVendors = useMemo(() => {
    let filtered = activeVendors;
    
    if (selectedCategory) {
      filtered = filtered.filter(v => v.category === selectedCategory);
    }
    
    if (minRating > 0) {
      filtered = filtered.filter(v => v.rating >= minRating);
    }

    return filtered;
  }, [activeVendors, selectedCategory, minRating]);

  // Fetch enhanced quotation data from API
  const fetchEnhancedQuotations = async (rfqId: string) => {
    try {
      const response = await rfqApi.getQuotations(rfqId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch enhanced quotations:', error);
      return null;
    }
  };

  // Get quotations for comparison - use enhanced data if available
  const rfqQuotations = useMemo(() => {
    if (!selectedRFQ) return [];
    
    // If we have enhanced data, use it
    if (enhancedQuotationData && enhancedQuotationData.quotations) {
      return enhancedQuotationData.quotations.map((item: any) => {
        const q = item.quotation;
        const vendor = item.vendor;
        const deliveryDays = q.delivery_days || Math.ceil(
          (new Date(q.delivery_date || q.deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return {
          ...q,
          vendorName: vendor?.name || vendor?.company_name || 'Unknown Vendor',
          vendorId: vendor?.id || vendor?.vendor_id,
          vendorRating: vendor?.rating || 0,
          vendorOrders: vendor?.total_orders || vendor?.orders || 0,
          vendorEmail: vendor?.email,
          deliveryDays,
          items: item.items || [],
          fullData: item, // Store full data for details view
          // Ensure payment_terms is included
          payment_terms: q.payment_terms || q.paymentTerms || q.payment_terms_text || '',
          paymentTerms: q.payment_terms || q.paymentTerms || q.payment_terms_text || '',
        };
      }).sort((a: any, b: any) => parseFloat(a.price || a.total_amount || '0') - parseFloat(b.price || b.total_amount || '0'));
    }
    
    // Fallback to context quotations
    return quotations
      .filter(q => q.rfqId === selectedRFQ.id)
      .map(q => {
        const vendor = vendors.find(v => v.id === q.vendorId);
        const deliveryDays = Math.ceil(
          (new Date(q.deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return {
          ...q,
          vendorRating: vendor?.rating || 0,
          vendorOrders: vendor?.orders || 0,
          deliveryDays,
          // Ensure payment_terms is included
          payment_terms: (q as any).payment_terms || (q as any).paymentTerms || (q as any).payment_terms_text || '',
          paymentTerms: (q as any).payment_terms || (q as any).paymentTerms || (q as any).payment_terms_text || '',
        };
      })
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }, [selectedRFQ, quotations, vendors, enhancedQuotationData]);

  // Calculate comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (rfqQuotations.length === 0) return null;

    const prices = rfqQuotations.map(q => parseFloat(q.price));
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    const deliveryDays = rfqQuotations.map(q => q.deliveryDays);
    const fastestDelivery = Math.min(...deliveryDays);

    const ratings = rfqQuotations.map(q => q.vendorRating);
    const highestRating = Math.max(...ratings);

    // Calculate scores for each quotation
    const scoredQuotations = rfqQuotations.map(q => {
      const priceScore = highestPrice > lowestPrice 
        ? ((highestPrice - parseFloat(q.price)) / (highestPrice - lowestPrice)) * 40 
        : 40;
      const deliveryScore = q.deliveryDays <= fastestDelivery 
        ? 30 
        : Math.max(0, 30 - ((q.deliveryDays - fastestDelivery) * 3));
      const vendorScore = (q.vendorRating / 5) * 30;
      const overallScore = priceScore + deliveryScore + vendorScore;

      return {
        ...q,
        priceScore: Math.round(priceScore),
        deliveryScore: Math.round(deliveryScore),
        vendorScore: Math.round(vendorScore),
        overallScore: Math.round(overallScore),
      };
    }).sort((a, b) => b.overallScore - a.overallScore);

    return {
      lowestPrice,
      highestPrice,
      avgPrice,
      fastestDelivery,
      highestRating,
      scoredQuotations,
      recommendedId: scoredQuotations[0]?.id,
    };
  }, [rfqQuotations]);

  const handleCreateRFQ = async () => {
    if (!selectedMRF || !deadline) {
      toast({
        title: "Validation Error",
        description: "Please select an MRF and set a deadline",
        variant: "destructive",
      });
      return;
    }

    let vendorIds: string[] = [];

    if (selectionMethod === 'all_category' && selectedCategory) {
      vendorIds = vendors
        .filter(v => v.category === selectedCategory && v.status === 'Active')
        .map(v => v.id);
    } else if (selectionMethod === 'preferred') {
      vendorIds = activeVendors
        .filter(v => v.rating >= 4.0 && v.orders >= 10)
        .slice(0, 5)
        .map(v => v.id);
    } else {
      vendorIds = selectedVendorIds;
    }

    if (vendorIds.length === 0) {
      toast({
        title: "No Vendors Selected",
        description: "Please select at least one vendor to receive the RFQ",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingRFQ(true);
    
    try {
      // Create RFQ via API
      const response = await rfqApi.create({
      mrfId: selectedMRF.id,
        title: selectedMRF.title,
      description: selectedMRF.description || '',
        category: selectedMRF.category || 'General',
        deadline: deadline,
        quantity: selectedMRF.quantity || '1',
        estimatedCost: selectedMRF.estimatedCost || '0',
        vendorIds: vendorIds,
      } as any);

      if (response.success) {
    toast({
      title: "RFQ Created & Dispatched",
      description: `RFQ sent to ${vendorIds.length} vendor(s). They will see it in their portal.`,
    });

    // Reset form
    setCreateDialogOpen(false);
    setSelectedMRF(null);
    setSelectedVendorIds([]);
    setDeadline('');
    setSelectionMethod('manual');
    setSelectedCategory('');
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create RFQ",
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
      setIsCreatingRFQ(false);
    }
  };

  // Handle viewing quotation details
  const handleViewQuotationDetails = async (quotation: any) => {
    setSelectedQuotation(quotation);
    setQuotationDetailsDialogOpen(true);
  };

  // Load enhanced quotation data when dialog opens
  useEffect(() => {
    if (compareDialogOpen && selectedRFQ) {
      fetchEnhancedQuotations(selectedRFQ.id).then(data => {
        if (data) {
          setEnhancedQuotationData(data);
        }
      });
    }
  }, [compareDialogOpen, selectedRFQ]);

  const handleAwardVendor = async (quotationId: string, vendorId: string) => {
    if (!selectedRFQ) return;

    setIsAwardingVendor(true);
    
    try {
      // Step 1: Select vendor via RFQ API (marks vendor as selected in RFQ)
      const selectResponse = await rfqApi.selectVendor(selectedRFQ.id, quotationId);

      if (!selectResponse.success) {
        // Enhanced error handling for workflow states
        let errorMessage = selectResponse.error || "Failed to award vendor";
        
        // Check for specific workflow state errors
        if (errorMessage.includes("not in procurement review") || errorMessage.includes("workflow state")) {
          errorMessage = "This MRF is not in the correct workflow state for vendor selection. Please ensure the MRF has been approved by the Executive and is ready for procurement review.";
        } else if (errorMessage.includes("executive approval") || errorMessage.includes("not approved")) {
          errorMessage = "Executive approval is required before selecting a vendor. Please wait for Executive approval.";
        } else if (errorMessage.includes("already selected") || errorMessage.includes("vendor already")) {
          errorMessage = "A vendor has already been selected for this RFQ.";
        }
        
        toast({
          title: "Vendor Selection Failed",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Step 2: Send selected vendor to Supply Chain Director for approval
      // This updates the MRF workflow state to vendor_selected
      if (selectedRFQ.mrfId) {
        const { mrfApi } = await import("@/services/api");
        const sendResponse = await mrfApi.sendVendorForApproval(
          selectedRFQ.mrfId,
          vendorId,
          quotationId
        );

        if (sendResponse.success) {
          toast({
            title: "Vendor Selection Sent for Approval",
            description: "Vendor has been selected and sent to Supply Chain Director for approval. You'll be able to generate PO after approval.",
          });
        } else {
          // Enhanced error handling for sending vendor for approval
          let errorMessage = sendResponse.error || "Unknown error";
          
          if (errorMessage.includes("workflow state") || errorMessage.includes("not in")) {
            errorMessage = "The MRF workflow state is not valid for sending vendor for approval. Please ensure the MRF is in the correct stage.";
          } else if (errorMessage.includes("executive approval")) {
            errorMessage = "Executive approval is required before sending vendor for Supply Chain Director approval.";
          }
          
          toast({
            title: "Partial Success",
            description: `Vendor was selected in RFQ, but failed to send for Supply Chain Director approval: ${errorMessage}`,
            variant: "destructive",
          });
        }
      } else {
        // No MRF ID in RFQ - fallback behavior
    toast({
      title: "Vendor Awarded",
          description: "The selected vendor has been awarded. MRF ID not found - please contact support.",
          variant: "default",
    });
      }

    onVendorSelected?.(vendorId, selectedRFQ.id);
    setCompareDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsAwardingVendor(false);
    }
  };

  const categories = [...new Set(vendors.map(v => v.category))];

  const getVendorBadge = (vendor: Vendor) => {
    if (vendor.rating >= 4.5 && vendor.orders >= 20) {
      return <Badge className="bg-amber-500 text-white ml-2">Preferred</Badge>;
    }
    if (vendor.rating >= 4.0) {
      return <Badge variant="secondary" className="ml-2">Top Rated</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* RFQ Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open RFQs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rfqs.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'Open' || status === 'open' || status === 'pending';
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting vendor quotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quotes Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return quotations.filter(q => {
                  // Check if quotation was received this month
                  const submittedDate = (q as any).submittedDate || (q as any).submitted_date || (q as any).created_at || (q as any).createdAt;
                  if (!submittedDate) return false;
                  try {
                    const quoteDate = new Date(submittedDate);
                    return quoteDate >= startOfMonth;
                  } catch {
                    return false;
                  }
                }).length;
              })()}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendors.filter(v => {
                const status = v.status || (v as any).status;
                return status === 'Active' || status === 'active' || status === 'verified' || status === 'Verified';
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Verified & ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Awarded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return rfqs.filter(r => {
                  const status = (r as any).status || r.status;
                  const isAwarded = status === 'Awarded' || status === 'awarded' || status === 'vendor_selected';
                  if (!isAwarded) return false;
                  // Check if awarded this month
                  const awardedDate = (r as any).awarded_at || (r as any).awardedAt || (r as any).updated_at || (r as any).updatedAt;
                  if (!awardedDate) return false;
                  try {
                    const awardDate = new Date(awardedDate);
                    return awardDate >= startOfMonth;
                  } catch {
                    return false;
                  }
                }).length;
              })()}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Create RFQ Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">RFQ Management</h3>
          <p className="text-sm text-muted-foreground">Create, dispatch, and manage quotation requests</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create RFQ
        </Button>
      </div>

      {/* Active RFQs */}
      <div className="grid gap-4 md:grid-cols-2">
        {rfqs.map((rfq) => {
          const rfqQuotes = quotations.filter(q => q.rfqId === rfq.id);
          const pendingQuotes = rfqQuotes.filter(q => q.status === 'Pending').length;
          
          return (
            <Card key={rfq.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{rfq.mrfTitle}</CardTitle>
                    <CardDescription className="mt-1">{rfq.id}</CardDescription>
                  </div>
                  <Badge 
                    className={
                      rfq.status === 'Open' ? 'bg-info/10 text-info' :
                      rfq.status === 'Awarded' ? 'bg-success/10 text-success' :
                      'bg-muted text-muted-foreground'
                    }
                  >
                    {rfq.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Budget</p>
                    <p className="font-semibold">₦{parseInt(rfq.estimatedCost).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Deadline</p>
                    <p className="font-semibold">{new Date(rfq.deadline).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vendors Invited</p>
                    <p className="font-semibold">{rfq.vendorIds.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Quotes Received</p>
                    <p className="font-semibold">{rfqQuotes.length}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1" 
                    onClick={async () => {
                      setSelectedRFQ(rfq);
                      setRfqDetailsDialogOpen(true);
                      // Fetch fresh quotation data and RFQ details from API
                      setLoadingRfqDetails(true);
                      try {
                        // Fetch RFQ details to get vendor count
                        const rfqDetailsResponse = await rfqApi.getById(rfq.id);
                        if (rfqDetailsResponse.success && rfqDetailsResponse.data) {
                          setRfqDetailsData(rfqDetailsResponse.data);
                        }
                        
                        // Fetch quotations
                        const response = await rfqApi.getQuotations(rfq.id);
                        if (response.success && response.data?.quotations) {
                          const formattedQuotations = response.data.quotations.map((item: any) => ({
                            ...item.quotation,
                            vendorName: item.vendor?.name || item.vendor?.company_name || 'Unknown Vendor',
                            vendorId: item.vendor?.id || item.vendor?.vendor_id,
                            vendorRating: item.vendor?.rating || 0,
                            vendorOrders: item.vendor?.total_orders || item.vendor?.orders || 0,
                            vendorEmail: item.vendor?.email,
                            items: item.items || [],
                            // Ensure delivery_days and payment_terms are available
                            deliveryDays: item.quotation?.delivery_days || item.quotation?.deliveryDays,
                            delivery_days: item.quotation?.delivery_days || item.quotation?.deliveryDays,
                            payment_terms: item.quotation?.payment_terms || item.quotation?.paymentTerms || item.quotation?.payment_terms_text,
                            paymentTerms: item.quotation?.payment_terms || item.quotation?.paymentTerms || item.quotation?.payment_terms_text,
                            status: item.quotation?.status || 'submitted',
                          }));
                          setRfqDetailsQuotations(formattedQuotations);
                        } else {
                          setRfqDetailsQuotations([]);
                        }
                      } catch (error) {
                        console.error('Failed to fetch RFQ details:', error);
                        setRfqDetailsQuotations([]);
                        setRfqDetailsData(null);
                      } finally {
                        setLoadingRfqDetails(false);
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                {pendingQuotes > 0 && rfq.status === 'Open' && (
                  <Button 
                      className="flex-1" 
                    onClick={() => {
                      setSelectedRFQ(rfq);
                      setCompareDialogOpen(true);
                    }}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                      Compare {pendingQuotes}
                  </Button>
                )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create RFQ Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Request for Quotation</DialogTitle>
            <DialogDescription>Select an MRF and vendors to request quotes from</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Select MRF */}
            <div className="space-y-2">
              <Label>Select MRF</Label>
              <Select 
                value={selectedMRF?.id || ''} 
                onValueChange={(val) => setSelectedMRF(mrfRequests.find(m => m.id === val) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an approved MRF" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleMRFs.map((mrf) => (
                    <SelectItem key={mrf.id} value={mrf.id}>
                      {mrf.title} - ₦{parseInt(mrf.estimatedCost).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleMRFs.length === 0 && (
                <p className="text-sm text-muted-foreground">No approved MRFs available for RFQ</p>
              )}
            </div>

            {selectedMRF && (
              <Card className="bg-accent/30">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Title</p>
                      <p className="font-medium">{selectedMRF.title}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estimated Cost</p>
                      <p className="font-medium">₦{parseInt(selectedMRF.estimatedCost).toLocaleString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Description</p>
                      <p className="font-medium">{selectedMRF.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* RFQ Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input 
                  type="date" 
                  value={deadline} 
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                    <SelectItem value="advance">100% Advance</SelectItem>
                    <SelectItem value="50-50">50% Advance, 50% on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vendor Selection Method */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Vendor Selection</Label>
              <Tabs value={selectionMethod} onValueChange={(v) => setSelectionMethod(v as any)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="manual">Manual Select</TabsTrigger>
                  <TabsTrigger value="all_category">By Category</TabsTrigger>
                  <TabsTrigger value="preferred">Preferred Only</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={minRating.toString()} onValueChange={(v) => setMinRating(parseFloat(v))}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Min rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Any Rating</SelectItem>
                        <SelectItem value="3">3+ Stars</SelectItem>
                        <SelectItem value="4">4+ Stars</SelectItem>
                        <SelectItem value="4.5">4.5+ Stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-[300px] border rounded-lg p-4">
                    {loadingVendors ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Loading vendors...</span>
                      </div>
                    ) : filteredVendors.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No vendors found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters or add vendors to the system</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredVendors.map((vendor) => (
                          <div 
                            key={vendor.id}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedVendorIds.includes(vendor.id) 
                                ? 'bg-primary/10 border-primary' 
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => {
                              if (selectedVendorIds.includes(vendor.id)) {
                                setSelectedVendorIds(selectedVendorIds.filter(id => id !== vendor.id));
                              } else {
                                setSelectedVendorIds([...selectedVendorIds, vendor.id]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selectedVendorIds.includes(vendor.id)}
                                onCheckedChange={() => {}}
                              />
                              <div>
                                <div className="flex items-center">
                                  <p className="font-medium">{vendor.name}</p>
                                  {getVendorBadge(vendor)}
                                </div>
                                <p className="text-sm text-muted-foreground">{vendor.category}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{vendor.orders} orders</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <p className="text-sm text-muted-foreground">
                    {selectedVendorIds.length} vendor(s) selected
                  </p>
                </TabsContent>

                <TabsContent value="all_category" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCategory && (
                    <p className="text-sm text-muted-foreground">
                      RFQ will be sent to all {vendors.filter(v => v.category === selectedCategory && v.status === 'Active').length} active vendors in {selectedCategory}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="preferred" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    RFQ will be sent to top 5 preferred vendors (rating 4.0+ and 10+ orders)
                  </p>
                  <div className="space-y-2">
                    {activeVendors
                      .filter(v => v.rating >= 4.0 && v.orders >= 10)
                      .slice(0, 5)
                      .map(vendor => (
                        <div key={vendor.id} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-amber-500" />
                            <div>
                              <p className="font-medium">{vendor.name}</p>
                              <p className="text-sm text-muted-foreground">{vendor.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            <span>{vendor.rating}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreatingRFQ}>Cancel</Button>
            <Button onClick={handleCreateRFQ} disabled={!selectedMRF || !deadline || isCreatingRFQ}>
              {isCreatingRFQ ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
              <Send className="h-4 w-4 mr-2" />
              Create & Dispatch RFQ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare Quotations Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Quotations</DialogTitle>
            <DialogDescription>
              {selectedRFQ?.mrfTitle} - {rfqQuotations.length} quote(s) received
            </DialogDescription>
          </DialogHeader>

          {comparisonMetrics && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-success/10">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Lowest Price</p>
                    <p className="text-xl font-bold text-success">₦{comparisonMetrics.lowestPrice.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-info/10">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Average Price</p>
                    <p className="text-xl font-bold text-info">₦{Math.round(comparisonMetrics.avgPrice).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/10">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Fastest Delivery</p>
                    <p className="text-xl font-bold text-primary">{comparisonMetrics.fastestDelivery} days</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/10">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Top Rating</p>
                    <p className="text-xl font-bold text-amber-500">{comparisonMetrics.highestRating} ⭐</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quotation Comparison */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {comparisonMetrics.scoredQuotations.map((quote, idx) => (
                    <Card 
                      key={quote.id} 
                      className={`transition-all ${
                        idx === 0 ? 'border-2 border-success ring-2 ring-success/20' : ''
                      }`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              {idx === 0 && (
                                <Badge className="bg-success text-success-foreground">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Recommended
                                </Badge>
                              )}
                              <h4 className="font-semibold text-lg">{quote.vendorName}</h4>
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                <span>{quote.vendorRating}</span>
                              </div>
                              <Badge variant="outline">{quote.vendorOrders} orders</Badge>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Quote Price</p>
                                <p className="text-xl font-bold">₦{parseInt(quote.price).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Delivery</p>
                                <p className="text-xl font-bold">{quote.deliveryDays} days</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Valid Until</p>
                                <p className="text-lg font-medium">
                                  {new Date(quote.deliveryDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Overall Score</p>
                                <p className="text-xl font-bold text-primary">{quote.overallScore}/100</p>
                              </div>
                            </div>

                            {/* Score Breakdown */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm w-24">Price</span>
                                <Progress value={quote.priceScore * 2.5} className="flex-1 h-2" />
                                <span className="text-sm w-12">{quote.priceScore}/40</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm w-24">Delivery</span>
                                <Progress value={quote.deliveryScore * 3.33} className="flex-1 h-2" />
                                <span className="text-sm w-12">{quote.deliveryScore}/30</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm w-24">Vendor</span>
                                <Progress value={quote.vendorScore * 3.33} className="flex-1 h-2" />
                                <span className="text-sm w-12">{quote.vendorScore}/30</span>
                              </div>
                            </div>

                            {quote.notes && (
                              <p className="text-sm text-muted-foreground mt-3 italic">"{quote.notes}"</p>
                            )}
                          </div>

                          <div className="ml-4 flex flex-col gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleViewQuotationDetails(quote)}
                              className="w-full"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button
                              onClick={() => handleAwardVendor(quote.id, quote.vendorId)}
                              className={idx === 0 ? 'bg-success hover:bg-success/90' : ''}
                              disabled={isAwardingVendor}
                            >
                              {isAwardingVendor ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Awarding...
                                </>
                              ) : (
                                <>
                              <Award className="h-4 w-4 mr-2" />
                              Award Vendor
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {rfqQuotations.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No quotations received yet</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quotation Details Dialog */}
      <Dialog open={quotationDetailsDialogOpen} onOpenChange={setQuotationDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation Details</DialogTitle>
            <DialogDescription>Complete quotation information</DialogDescription>
          </DialogHeader>
          {selectedQuotation && (
            <div className="space-y-6 mt-4">
              {/* Vendor Information */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-3">Vendor Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Vendor Name</Label>
                    <p className="font-medium">{selectedQuotation.vendorName || selectedQuotation.vendor?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Rating</Label>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <p className="font-medium">{selectedQuotation.vendorRating || selectedQuotation.vendor?.rating || 'N/A'}</p>
                    </div>
                  </div>
                  {selectedQuotation.vendorEmail && (
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{selectedQuotation.vendorEmail}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Total Orders</Label>
                    <p className="font-medium">{selectedQuotation.vendorOrders || selectedQuotation.vendor?.total_orders || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="font-semibold text-lg">₦{parseFloat(selectedQuotation.price || selectedQuotation.total_amount || '0').toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currency</Label>
                  <p className="font-medium">{selectedQuotation.currency || 'NGN'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Delivery Days</Label>
                  <p className="font-medium">{selectedQuotation.deliveryDays || selectedQuotation.delivery_days || 'N/A'} days</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Delivery Date</Label>
                  <p className="font-medium">
                    {selectedQuotation.deliveryDate || selectedQuotation.delivery_date 
                      ? new Date(selectedQuotation.deliveryDate || selectedQuotation.delivery_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Terms</Label>
                  <p className="font-medium">
                    {selectedQuotation.payment_terms || selectedQuotation.paymentTerms || selectedQuotation.payment_terms_text || (selectedQuotation as any).payment_terms_text || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Validity Period</Label>
                  <p className="font-medium">{selectedQuotation.validity_days || selectedQuotation.validityDays || 'N/A'} days</p>
                </div>
                {selectedQuotation.warranty_period && (
                  <div>
                    <Label className="text-muted-foreground">Warranty Period</Label>
                    <p className="font-medium">{selectedQuotation.warranty_period}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              {(selectedQuotation.items && selectedQuotation.items.length > 0) && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Quotation Items</Label>
                  <div className="space-y-2">
                    {selectedQuotation.items.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-md">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{item.item_name || item.name || `Item ${idx + 1}`}</p>
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                              <span>Quantity: {item.quantity || 'N/A'}</span>
                              <span>Unit Price: ₦{parseFloat(item.unit_price || item.unitPrice || '0').toLocaleString()}</span>
                              <span>Total: ₦{parseFloat(item.total_price || (item.quantity * item.unit_price) || '0').toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedQuotation.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{selectedQuotation.notes}</p>
                </div>
              )}

              {/* Attachments */}
              {selectedQuotation.attachments && selectedQuotation.attachments.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Attachments</Label>
                  <div className="space-y-2">
                    {selectedQuotation.attachments.map((attachment: any, idx: number) => (
                      <div key={idx} className="p-2 border rounded-md flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{attachment.fileName || attachment.name || `Attachment ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MRF Information (if available from enhanced data) */}
              {enhancedQuotationData?.mrf && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Related MRF</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">MRF ID</Label>
                      <p className="font-medium">{enhancedQuotationData.mrf.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Contract Type</Label>
                      <p className="font-medium">{enhancedQuotationData.mrf.contractType || 'N/A'}</p>
                    </div>
                    {enhancedQuotationData.mrf.executiveApproved && (
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <Label className="text-muted-foreground">Executive Approved</Label>
                          {enhancedQuotationData.mrf.executiveApprovedAt && (
                            <p className="text-sm text-muted-foreground">
                              on {new Date(enhancedQuotationData.mrf.executiveApprovedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Statistics (if available) */}
              {enhancedQuotationData?.statistics && (
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Total Quotations</p>
                      <p className="text-xl font-bold">{enhancedQuotationData.statistics.total_quotations}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Lowest Bid</p>
                      <p className="text-xl font-bold">₦{enhancedQuotationData.statistics.lowest_bid?.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Highest Bid</p>
                      <p className="text-xl font-bold">₦{enhancedQuotationData.statistics.highest_bid?.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Average Bid</p>
                      <p className="text-xl font-bold">₦{Math.round(enhancedQuotationData.statistics.average_bid || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RFQ Details Dialog */}
      <Dialog open={rfqDetailsDialogOpen} onOpenChange={setRfqDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>RFQ Details - {selectedRFQ?.id}</DialogTitle>
            <DialogDescription>{selectedRFQ?.mrfTitle}</DialogDescription>
          </DialogHeader>
          {loadingRfqDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading RFQ details...</span>
            </div>
          ) : selectedRFQ && (() => {
            // Use fetched quotations from API, fallback to context if empty
            const rfqQuotations = rfqDetailsQuotations.length > 0 
              ? rfqDetailsQuotations 
              : quotations.filter(q => q.rfqId === selectedRFQ.id);
            
            // Get delivery days and payment terms from quotations (not RFQ)
            // Use the first quotation or the selected/awarded quotation if available
            const selectedQuotation = rfqQuotations.find((q: any) => q.status === 'approved' || q.status === 'awarded') || rfqQuotations[0] || null;
            const deliveryDays = selectedQuotation?.deliveryDays || selectedQuotation?.delivery_days || null;
            const paymentTerms = selectedQuotation?.payment_terms || selectedQuotation?.paymentTerms || selectedQuotation?.payment_terms_text || null;
            
            // Get vendor count from RFQ details or fallback to vendorIds array
            const vendorCount = rfqDetailsData?.vendorIds?.length || 
                               rfqDetailsData?.vendors_count || 
                               rfqDetailsData?.vendor_count ||
                               selectedRFQ.vendorIds?.length || 
                               0;
            
            // Get RFQ sent/dispatched timestamp - use createdDate
            const sentAt = selectedRFQ.createdDate || null;
            
            return (
              <div className="space-y-6 mt-4">
                {/* RFQ Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">RFQ ID</Label>
                    <p className="font-medium">{selectedRFQ.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge 
                      className={
                        selectedRFQ.status === 'Open' ? 'bg-info/10 text-info' :
                        selectedRFQ.status === 'Awarded' ? 'bg-success/10 text-success' :
                        'bg-muted text-muted-foreground'
                      }
                    >
                      {selectedRFQ.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">MRF Title</Label>
                    <p className="font-medium">{selectedRFQ.mrfTitle}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Budget</Label>
                    <p className="font-medium">₦{parseInt(selectedRFQ.estimatedCost || '0').toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Deadline</Label>
                    <p className="font-medium">
                      {selectedRFQ.deadline ? new Date(selectedRFQ.deadline).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sent At</Label>
                    <p className="font-medium">
                      {sentAt 
                        ? new Date(sentAt).toLocaleString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Vendors Invited</Label>
                    <p className="font-medium">{vendorCount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quotations Received</Label>
                    <p className="font-medium">{rfqQuotations.length}</p>
                  </div>
                </div>

                {/* Quotation Data (from vendor quotations) */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Quotation Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Delivery Days</Label>
                      <p className="font-medium">
                        {deliveryDays !== null && deliveryDays !== undefined 
                          ? `${deliveryDays} days` 
                          : loadingRfqDetails
                            ? 'Loading...'
                            : rfqQuotations.length > 0 
                              ? 'N/A' 
                              : 'No quotations received yet'}
                      </p>
                      {rfqQuotations.length > 1 && deliveryDays !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {rfqQuotations.length} quotations received with varying delivery timelines
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Payment Terms</Label>
                      <p className="font-medium">
                        {paymentTerms && paymentTerms.trim() !== '' 
                          ? paymentTerms 
                          : loadingRfqDetails
                            ? 'Loading...'
                            : rfqQuotations.length > 0 
                              ? 'N/A' 
                              : 'No quotations received yet'}
                      </p>
                      {rfqQuotations.length > 1 && paymentTerms && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Terms vary by quotation
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quotations List */}
                {rfqQuotations.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Received Quotations</h3>
                    <div className="space-y-3">
                      {rfqQuotations.map((quotation: any) => (
                        <Card key={quotation.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-medium">{quotation.vendorName || quotation.vendor?.name || 'Vendor'}</p>
                                  <Badge variant={quotation.status === 'approved' ? 'default' : quotation.status === 'closed' ? 'secondary' : 'outline'}>
                                    {quotation.status || 'submitted'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Amount</p>
                                    <p className="font-medium">₦{parseFloat(quotation.price || quotation.total_amount || '0').toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Delivery Days</p>
                                    <p className="font-medium">{quotation.deliveryDays || quotation.delivery_days || 'N/A'} days</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Payment Terms</p>
                                    <p className="font-medium">
                                      {quotation.payment_terms || quotation.paymentTerms || quotation.payment_terms_text || (quotation as any).payment_terms_text || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 ml-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedQuotation(quotation);
                                    handleViewQuotationDetails(quotation);
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                                {quotation.status === 'submitted' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const response = await quotationApi.closeQuotation(quotation.id);
                                        if (response.success) {
                                          toast({
                                            title: "Quotation Closed",
                                            description: "The quotation has been closed.",
                                          });
                                          // Refresh quotations
                                          // Refresh RFQ details to update quotations
                                          await rfqApi.getQuotations(selectedRFQ.id);
                                        } else {
                                          toast({
                                            title: "Error",
                                            description: response.error || "Failed to close quotation",
                                            variant: "destructive",
                                          });
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to close quotation",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    Close
                                  </Button>
                                )}
                                {quotation.status === 'closed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const response = await quotationApi.reopenQuotation(quotation.id);
                                        if (response.success) {
                                          toast({
                                            title: "Quotation Reopened",
                                            description: "The quotation has been reopened.",
                                          });
                                          // Refresh quotations
                                          // Refresh RFQ details to update quotations
                                          await rfqApi.getQuotations(selectedRFQ.id);
                                        } else {
                                          toast({
                                            title: "Error",
                                            description: response.error || "Failed to reopen quotation",
                                            variant: "destructive",
                                          });
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to reopen quotation",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    Reopen
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
