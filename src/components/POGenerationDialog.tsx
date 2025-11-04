import { useState } from "react";
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { MRFRequest } from "@/contexts/AppContext";

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
  }) => void;
}

export function POGenerationDialog({ open, onOpenChange, mrf, onGenerate }: POGenerationDialogProps) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(mrf?.estimatedCost || "");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vendor || !deliveryDate || !paymentTerms) {
      return;
    }

    onGenerate({
      vendor,
      items: mrf?.description || "",
      amount: amount,
      deliveryDate: format(deliveryDate, "yyyy-MM-dd"),
      paymentTerms,
      notes
    });

    // Reset form
    setVendor("");
    setAmount("");
    setDeliveryDate(undefined);
    setPaymentTerms("");
    setNotes("");
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
              <Select value={vendor} onValueChange={setVendor} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="Emerald Supplies Ltd">Emerald Supplies Ltd</SelectItem>
                  <SelectItem value="Tech Solutions Inc">Tech Solutions Inc</SelectItem>
                  <SelectItem value="Global Materials Co">Global Materials Co</SelectItem>
                  <SelectItem value="Premium Vendors LLC">Premium Vendors LLC</SelectItem>
                  <SelectItem value="Quality Distributors">Quality Distributors</SelectItem>
                  <SelectItem value="Swift Logistics">Swift Logistics</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Generate PO</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
