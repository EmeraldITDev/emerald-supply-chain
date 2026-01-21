import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Upload, 
  X, 
  Send, 
  Clock, 
  CheckCircle, 
  DollarSign,
  Paperclip,
  Calendar,
  Truck,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RFQ } from "@/contexts/AppContext";

interface VendorQuoteSubmissionProps {
  rfqs: RFQ[];
  vendorId: string;
  vendorName: string;
  onSubmit: (quote: {
    rfqId: string;
    vendorId: string;
    vendorName: string;
    price: string;
    deliveryDate: string;
    notes: string;
    attachments: File[];
    lineItems: QuoteLineItem[];
    validityPeriod: string;
    paymentTerms: string;
    warrantyPeriod: string;
  }) => void;
  onSave?: (quote: {
    rfqId: string;
    lineItems: QuoteLineItem[];
    deliveryDate: string;
    notes: string;
    attachments: File[];
    validityPeriod: string;
    paymentTerms: string;
    warrantyPeriod: string;
  }) => void;
  onIgnore?: (rfqId: string) => void;
  draftToLoad?: {
    rfqId: string;
    lineItems: QuoteLineItem[];
    deliveryDate: string;
    notes: string;
    validityPeriod: string;
    paymentTerms: string;
    warrantyPeriod: string;
  } | null;
}

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export const VendorQuoteSubmission = ({ rfqs, vendorId, vendorName, onSubmit, onSave, onIgnore, draftToLoad }: VendorQuoteSubmissionProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedRfqId, setSelectedRfqId] = useState(draftToLoad?.rfqId || "");
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
    draftToLoad?.lineItems && draftToLoad.lineItems.length > 0 
      ? draftToLoad.lineItems 
      : [{ description: "", quantity: 1, unitPrice: 0, total: 0 }]
  );
  const [deliveryDate, setDeliveryDate] = useState(draftToLoad?.deliveryDate || "");
  const [notes, setNotes] = useState(draftToLoad?.notes || "");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [validityPeriod, setValidityPeriod] = useState(draftToLoad?.validityPeriod || "30");
  const [paymentTerms, setPaymentTerms] = useState(draftToLoad?.paymentTerms || "");
  const [warrantyPeriod, setWarrantyPeriod] = useState(draftToLoad?.warrantyPeriod || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load draft when draftToLoad changes
  useEffect(() => {
    if (draftToLoad) {
      setSelectedRfqId(draftToLoad.rfqId);
      setLineItems(draftToLoad.lineItems.length > 0 ? draftToLoad.lineItems : [{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
      setDeliveryDate(draftToLoad.deliveryDate);
      setNotes(draftToLoad.notes);
      setValidityPeriod(draftToLoad.validityPeriod);
      setPaymentTerms(draftToLoad.paymentTerms);
      setWarrantyPeriod(draftToLoad.warrantyPeriod);
    }
  }, [draftToLoad]);

  const openRfqs = rfqs.filter(r => r.status === "Open");
  const selectedRfq = rfqs.find(r => r.id === selectedRfqId);

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const updateLineItem = (index: number, field: keyof QuoteLineItem, value: string | number) => {
    const newItems = [...lineItems];
    if (field === 'quantity' || field === 'unitPrice') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      newItems[index] = { 
        ...newItems[index], 
        [field]: numValue,
        total: field === 'quantity' 
          ? numValue * newItems[index].unitPrice 
          : newItems[index].quantity * numValue
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments([...attachments, ...files]);
      toast({ 
        title: "File Attached", 
        description: `${files.length} document(s) added` 
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!selectedRfqId) errors.rfq = "Please select an RFQ";
    if (!deliveryDate) errors.deliveryDate = "Delivery date is required";
    if (lineItems.some(item => !item.description.trim())) {
      errors.lineItems = "All items must have descriptions";
    }
    if (lineItems.some(item => item.unitPrice <= 0)) {
      errors.lineItems = "All items must have valid prices";
    }
    if (!paymentTerms) errors.paymentTerms = "Payment terms are required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    // Simulate async submission
    await new Promise(resolve => setTimeout(resolve, 1000));

    onSubmit({
      rfqId: selectedRfqId,
      vendorId,
      vendorName,
      price: calculateTotal().toString(),
      deliveryDate,
      notes,
      attachments,
      lineItems,
      validityPeriod,
      paymentTerms,
      warrantyPeriod,
    });

    // Reset form
    setSelectedRfqId("");
    setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
    setDeliveryDate("");
    setNotes("");
    setAttachments([]);
    setValidityPeriod("30");
    setPaymentTerms("");
    setWarrantyPeriod("");
    setFormErrors({});
    setIsSubmitting(false);

    toast({
      title: "Quote Submitted Successfully",
      description: "Your quotation has been sent to the Procurement Manager",
    });
  };

  return (
    <div className="space-y-6">
      {/* Open RFQs Summary */}
      {openRfqs.length > 0 && (
        <Card className="border-info/20 bg-info/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-info" />
              Open Requests for Quotation ({openRfqs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {openRfqs.map(rfq => (
                <div 
                  key={rfq.id}
                  onClick={() => setSelectedRfqId(rfq.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedRfqId === rfq.id 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-muted-foreground">{rfq.id}</span>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {rfq.deadline}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{rfq.mrfTitle}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quote Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Quotation
          </CardTitle>
          <CardDescription>
            Provide detailed pricing and terms for the selected RFQ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* RFQ Selection */}
          <div className="space-y-2">
            <Label>Select RFQ *</Label>
            <Select value={selectedRfqId} onValueChange={setSelectedRfqId}>
              <SelectTrigger className={formErrors.rfq ? "border-destructive" : ""}>
                <SelectValue placeholder="Choose an RFQ to quote" />
              </SelectTrigger>
              <SelectContent>
                {openRfqs.map(rfq => (
                  <SelectItem key={rfq.id} value={rfq.id}>
                    {rfq.id} - {rfq.mrfTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.rfq && <p className="text-sm text-destructive">{formErrors.rfq}</p>}
          </div>

          {/* Selected RFQ Details */}
          {selectedRfq && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-semibold">{selectedRfq.mrfTitle}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <p className="font-medium">{selectedRfq.quantity} units</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Deadline:</span>
                  <p className="font-medium text-warning">{selectedRfq.deadline}</p>
                </div>
              </div>
              {selectedRfq.description && (
                <div>
                  <span className="text-muted-foreground text-sm">Description:</span>
                  <p className="text-sm mt-1">{selectedRfq.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Quote Line Items *
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                + Add Item
              </Button>
            </div>
            
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-muted/30">
                  <div className="col-span-12 md:col-span-5">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="col-span-5 md:col-span-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                      <Input
                        type="number"
                        placeholder="Unit Price"
                        className="pl-7"
                        min="0"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-2 flex items-center justify-between">
                    <span className="font-medium text-sm">₦{(item.quantity * item.unitPrice).toLocaleString()}</span>
                    {lineItems.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeLineItem(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {formErrors.lineItems && <p className="text-sm text-destructive">{formErrors.lineItems}</p>}
            
            <div className="flex justify-end p-3 bg-primary/5 rounded-lg">
              <div className="text-right">
                <span className="text-muted-foreground">Total Quote Amount:</span>
                <p className="text-2xl font-bold text-primary">₦{calculateTotal().toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Delivery & Terms */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Proposed Delivery Date *
              </Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={formErrors.deliveryDate ? "border-destructive" : ""}
              />
              {formErrors.deliveryDate && <p className="text-sm text-destructive">{formErrors.deliveryDate}</p>}
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Quote Validity (Days)
              </Label>
              <Select value={validityPeriod} onValueChange={setValidityPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="45">45 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Payment Terms *
              </Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className={formErrors.paymentTerms ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">100% Advance</SelectItem>
                  <SelectItem value="50-50">50% Advance, 50% on Delivery</SelectItem>
                  <SelectItem value="delivery">100% on Delivery</SelectItem>
                  <SelectItem value="net-30">Net 30 Days</SelectItem>
                  <SelectItem value="net-60">Net 60 Days</SelectItem>
                  <SelectItem value="lc">Letter of Credit</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.paymentTerms && <p className="text-sm text-destructive">{formErrors.paymentTerms}</p>}
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Warranty Period
              </Label>
              <Select value={warrantyPeriod} onValueChange={setWarrantyPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warranty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Warranty</SelectItem>
                  <SelectItem value="3-months">3 Months</SelectItem>
                  <SelectItem value="6-months">6 Months</SelectItem>
                  <SelectItem value="1-year">1 Year</SelectItem>
                  <SelectItem value="2-years">2 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Supporting Documents
            </Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((file, index) => (
                  <Badge key={index} variant="secondary" className="gap-2 py-1">
                    <Paperclip className="h-3 w-3" />
                    {file.name}
                    <button onClick={() => removeAttachment(index)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Attach product catalogs, certifications, or detailed specifications (PDF, Word, Excel, Images)
            </p>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label>Additional Notes / Terms</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Include any special terms, conditions, or additional information..."
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleSubmit} 
              className="flex-1" 
              size="lg"
              disabled={isSubmitting || !selectedRfqId}
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Quotation
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => {
                if (!selectedRfqId) {
                  toast({
                    title: "No RFQ Selected",
                    description: "Please select an RFQ to save",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (onSave) {
                  onSave({
                    rfqId: selectedRfqId,
                    lineItems,
                    deliveryDate,
                    notes,
                    attachments,
                    validityPeriod,
                    paymentTerms,
                    warrantyPeriod,
                  });
                } else {
                  // Fallback: save to localStorage if onSave not provided
                  const draftKey = `rfq_draft_${selectedRfqId}_${vendorId}`;
                  const draftData = {
                    rfqId: selectedRfqId,
                    lineItems,
                    deliveryDate,
                    notes,
                    validityPeriod,
                    paymentTerms,
                    warrantyPeriod,
                    savedAt: new Date().toISOString(),
                  };
                  localStorage.setItem(draftKey, JSON.stringify(draftData));
                }
                
                toast({
                  title: "Draft Saved",
                  description: "Your quotation draft has been saved. You can continue later.",
                });
              }}
              variant="outline"
              className="flex-1"
              size="lg"
              disabled={!selectedRfqId}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Save & Close
            </Button>
            
            <Button 
              onClick={() => {
                if (!selectedRfqId) {
                  toast({
                    title: "No RFQ Selected",
                    description: "Please select an RFQ to ignore",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (confirm('Are you sure you want to ignore this RFQ? You can still access it later from the RFQs tab.')) {
                  if (onIgnore) {
                    onIgnore(selectedRfqId);
                  } else {
                    // Fallback: mark as ignored in localStorage if onIgnore not provided
                    const ignoredKey = `ignored_rfqs_${vendorId}`;
                    const ignored = JSON.parse(localStorage.getItem(ignoredKey) || '[]');
                    if (!ignored.includes(selectedRfqId)) {
                      ignored.push(selectedRfqId);
                      localStorage.setItem(ignoredKey, JSON.stringify(ignored));
                    }
                  }
                  
                  // Reset form
                  setSelectedRfqId("");
                  setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
                  setDeliveryDate("");
                  setNotes("");
                  setAttachments([]);
                  setValidityPeriod("30");
                  setPaymentTerms("");
                  setWarrantyPeriod("");
                  setFormErrors({});
                  
                  toast({
                    title: "RFQ Ignored",
                    description: "You can access this RFQ later from the RFQs tab.",
                  });
                }
              }}
              variant="outline"
              size="lg"
              className="border-muted-foreground/50 text-muted-foreground hover:text-foreground"
              disabled={!selectedRfqId}
            >
              <X className="h-4 w-4 mr-2" />
              Ignore RFQ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
