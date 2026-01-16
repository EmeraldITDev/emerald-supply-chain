import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { MRFRequest } from "@/contexts/AppContext";
import { vendorApi } from "@/services/api";
import type { Vendor } from "@/types";

interface POGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrf: MRFRequest | null;
  onGenerate: (poData: {
    vendors: string[];
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
    poFile: File | null;
  }) => Promise<void>;
  onSave?: (poData: {
    vendors: string[];
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
    poFile: File | null;
  }) => Promise<void>;
  isGenerating?: boolean;
}

export function POGenerationDialog({ open, onOpenChange, mrf, onGenerate, onSave, isGenerating = false }: POGenerationDialogProps) {
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [amount, setAmount] = useState(mrf?.estimatedCost || "");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [poFile, setPOFile] = useState<File | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch vendors when dialog opens
  useEffect(() => {
    if (open) {
      fetchVendors();
    }
  }, [open]);

  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const response = await vendorApi.getAll();
      if (response.success && response.data) {
        // Filter only active vendors
        const activeVendors = response.data.filter(v => v.status === 'Active');
        setVendors(activeVendors);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, sendToVendors: boolean = true) => {
    e.preventDefault();
    
    if (sendToVendors) {
      if (selectedVendorIds.length === 0 || !deliveryDate || !paymentTerms || !poFile) {
        console.warn('PO Generation: Missing required fields', { vendors: selectedVendorIds.length, deliveryDate, paymentTerms, hasFile: !!poFile });
        return;
      }
    } else {
      // For save only, we can save without all fields
      if (selectedVendorIds.length === 0) {
        console.warn('PO Generation: At least one vendor must be selected');
        return;
      }
    }

    const poData = {
      vendors: selectedVendorIds,
      items: mrf?.description || "",
      amount: amount,
      deliveryDate: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : "",
      paymentTerms,
      notes,
      poFile
    };

    if (sendToVendors) {
      setIsSubmitting(true);
      try {
        await onGenerate(poData);
        // Reset form only on success
        setSelectedVendorIds([]);
        setAmount("");
        setDeliveryDate(undefined);
        setPaymentTerms("");
        setNotes("");
        setPOFile(null);
        onOpenChange(false);
      } catch (error) {
        console.error('PO Generation: Submit failed', error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Save without sending
      if (onSave) {
        setIsSaving(true);
        try {
          await onSave(poData);
          onOpenChange(false);
        } catch (error) {
          console.error('PO Generation: Save failed', error);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>Generate PO</DialogTitle>
          <DialogDescription>
            Send request to vendors for approved MRF: {mrf?.id}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* MRF Details (Read-only) - Full Information Display */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3 border">
            <h3 className="font-semibold text-sm mb-3">MRF Request Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">MRF ID:</span>
                <p className="font-medium">{mrf?.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Requester:</span>
                <p className="font-medium">{mrf?.requester || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Title:</span>
                <p className="font-medium">{mrf?.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Category:</span>
                <p className="font-medium capitalize">{mrf?.category?.replace('-', ' ') || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Urgency:</span>
                <p className="font-medium capitalize">{mrf?.urgency || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Quantity:</span>
                <p className="font-medium">{mrf?.quantity || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Estimated Cost:</span>
                <p className="font-medium text-primary">₦{mrf?.estimatedCost ? parseFloat(String(mrf.estimatedCost)).toLocaleString() : 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Description:</span>
                <p className="font-medium text-sm mt-1">{mrf?.description || 'No description provided'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Justification:</span>
                <p className="font-medium text-sm mt-1">{mrf?.justification || 'No justification provided'}</p>
              </div>
              {mrf?.department && (
                <div>
                  <span className="text-muted-foreground text-xs">Department:</span>
                  <p className="font-medium">{mrf.department}</p>
                </div>
              )}
              {mrf?.date && (
                <div>
                  <span className="text-muted-foreground text-xs">Request Date:</span>
                  <p className="font-medium">{new Date(mrf.date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* PO Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendors">Select Vendors/Suppliers *</Label>
              <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                {loadingVendors ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Loading vendors...</span>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No active vendors found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vendors.map((v) => (
                      <div key={v.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md">
                        <Checkbox
                          id={`vendor-${v.id}`}
                          checked={selectedVendorIds.includes(v.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedVendorIds([...selectedVendorIds, v.id]);
                            } else {
                              setSelectedVendorIds(selectedVendorIds.filter(id => id !== v.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`vendor-${v.id}`}
                          className="flex-1 cursor-pointer text-sm font-medium"
                        >
                          {v.name}
                          {v.category && (
                            <span className="text-xs text-muted-foreground ml-2">({v.category})</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedVendorIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedVendorIds.map((vendorId) => {
                    const vendor = vendors.find(v => v.id === vendorId);
                    return vendor ? (
                      <Badge key={vendorId} variant="secondary" className="flex items-center gap-1">
                        {vendor.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setSelectedVendorIds(selectedVendorIds.filter(id => id !== vendorId))}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              {!loadingVendors && vendors.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active vendors available. Please ensure vendors are registered and activated in the system.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poFile">Upload PO Document *</Label>
              <Input
                id="poFile"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPOFile(e.target.files?.[0] || null)}
                required
              />
              {poFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {poFile.name} ({(poFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, DOC, DOCX (Max 10MB)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Order Amount (₦) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 50000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Expected Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms *</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Net 30">Net 30 Days</SelectItem>
                  <SelectItem value="Net 60">Net 60 Days</SelectItem>
                  <SelectItem value="50% Advance">50% Advance, 50% on Delivery</SelectItem>
                  <SelectItem value="Full Advance">Full Payment in Advance</SelectItem>
                  <SelectItem value="On Delivery">Payment on Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, shipping requirements, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isGenerating || isSaving}
            >
              Cancel
            </Button>
            {onSave && (
              <Button 
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, false)}
                disabled={selectedVendorIds.length === 0 || isSubmitting || isGenerating || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save and Close'
                )}
              </Button>
            )}
            <Button 
              type="submit" 
              onClick={(e) => handleSubmit(e, true)}
              disabled={selectedVendorIds.length === 0 || !deliveryDate || !paymentTerms || !poFile || isSubmitting || isGenerating || isSaving}
            >
              {isSubmitting || isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Save and Send to Vendors'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
