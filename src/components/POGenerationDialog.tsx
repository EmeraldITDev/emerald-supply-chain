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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { MRFRequest } from "@/contexts/AppContext";
import { vendorApi } from "@/services/api";
import type { Vendor } from "@/types";

interface POGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mrf: MRFRequest | null;
  onGenerate: (poData: {
    vendor: string;
    items: string;
    amount: string;
    deliveryDate: string;
    paymentTerms: string;
    notes: string;
    poFile: File | null;
  }) => Promise<void>;
  isGenerating?: boolean;
}

export function POGenerationDialog({ open, onOpenChange, mrf, onGenerate, isGenerating = false }: POGenerationDialogProps) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(mrf?.estimatedCost || "");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [poFile, setPOFile] = useState<File | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vendor || !deliveryDate || !paymentTerms || !poFile) {
      console.warn('PO Generation: Missing required fields', { vendor, deliveryDate, paymentTerms, hasFile: !!poFile });
      return;
    }

    console.log('PO Generation: Submitting', {
      vendor,
      mrfId: mrf?.id,
      amount,
      deliveryDate: format(deliveryDate, "yyyy-MM-dd"),
      paymentTerms,
      fileName: poFile.name,
      fileSize: poFile.size
    });

    setIsSubmitting(true);
    try {
      await onGenerate({
        vendor,
        items: mrf?.description || "",
        amount: amount,
        deliveryDate: format(deliveryDate, "yyyy-MM-dd"),
        paymentTerms,
        notes,
        poFile
      });

      // Reset form only on success
      setVendor("");
      setAmount("");
      setDeliveryDate(undefined);
      setPaymentTerms("");
      setNotes("");
      setPOFile(null);
    } catch (error) {
      console.error('PO Generation: Submit failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>Generate Purchase Order</DialogTitle>
          <DialogDescription>
            Create a PO for approved MRF: {mrf?.id}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* MRF Details (Read-only) */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">MRF ID:</span>
                <p className="font-medium">{mrf?.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Title:</span>
                <p className="font-medium">{mrf?.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p className="font-medium capitalize">{mrf?.category}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity:</span>
                <p className="font-medium">{mrf?.quantity}</p>
              </div>
            </div>
          </div>

          {/* PO Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor/Supplier *</Label>
              <Select value={vendor} onValueChange={setVendor} required disabled={loadingVendors}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingVendors ? "Loading vendors..." : "Select vendor"} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
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
                    vendors.map((v) => (
                      <SelectItem key={v.id} value={v.name}>
                        {v.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isGenerating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!vendor || !deliveryDate || !paymentTerms || !poFile || isSubmitting || isGenerating}
            >
              {isSubmitting || isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate PO'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
