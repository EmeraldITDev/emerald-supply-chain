import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vendorApi } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import {
  VENDOR_CATEGORIES,
  OTHERS_VENDOR_CATEGORY,
} from "@/types/vendor-registration";

interface Props {
  vendorId: number | string;
  vendorName: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const VENDOR_STATUSES = ["Active", "Pending", "Inactive", "Suspended"] as const;

const emptyForm = {
  companyName: "",
  contactPerson: "",
  contactPersonTitle: "",
  email: "",
  phone: "",
  alternatePhone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  taxId: "",
  status: "",
  categories: [] as string[],
  categoryOther: "",
  annualRevenue: "",
  numberOfEmployees: "",
  yearEstablished: "",
  website: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
};

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function toCategories(v: any): string[] {
  if (Array.isArray(v.categories)) return v.categories.map(String);
  const raw = str(v.category);
  return raw ? raw.split(",").map((c: string) => c.trim()).filter(Boolean) : [];
}

export function VendorProfileEditDialog({
  vendorId,
  vendorName,
  open,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const set = (key: keyof typeof emptyForm, value: string | string[]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleCategory = (category: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(category)
        ? f.categories.filter((c) => c !== category)
        : [...f.categories, category],
    }));

  // Fetch full vendor record when dialog opens
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    vendorApi
      .getById(String(vendorId))
      .then((res) => {
        const v = (res?.data ?? {}) as any;
        setForm({
          companyName: str(v.company_name ?? v.companyName ?? v.name ?? vendorName),
          contactPerson: str(v.contact_person ?? v.contactPerson),
          contactPersonTitle: str(v.contact_person_title ?? v.contactPersonTitle),
          email: str(v.email),
          phone: str(v.phone ?? v.phone_number),
          alternatePhone: str(v.alternate_phone ?? v.alternatePhone),
          address: str(v.address),
          city: str(v.city),
          state: str(v.state),
          country: str(v.country),
          postalCode: str(v.postal_code ?? v.postalCode),
          taxId: str(v.tax_id ?? v.taxId),
          status: str(v.status),
          categories: toCategories(v),
          categoryOther: str(v.category_other ?? v.categoryOther),
          annualRevenue: str(v.annual_revenue ?? v.annualRevenue),
          numberOfEmployees: str(v.number_of_employees ?? v.numberOfEmployees),
          yearEstablished: str(v.year_established ?? v.yearEstablished),
          website: str(v.website),
          bankName: str(v.bank_name ?? v.bankName),
          accountName: str(v.account_name ?? v.accountName),
          accountNumber: str(v.account_number ?? v.accountNumber),
        });
      })
      .finally(() => setFetching(false));
  }, [open, vendorId, vendorName]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await vendorApi.updateAdmin(vendorId, {
        companyName: form.companyName.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        contactPersonTitle: form.contactPersonTitle.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        alternatePhone: form.alternatePhone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        status: form.status || undefined,
        categories: form.categories.length ? form.categories : undefined,
        categoryOther: form.categories.includes(OTHERS_VENDOR_CATEGORY)
          ? form.categoryOther.trim() || undefined
          : undefined,
        annualRevenue: form.annualRevenue.trim() || undefined,
        numberOfEmployees: form.numberOfEmployees.trim() || undefined,
        yearEstablished: form.yearEstablished
          ? Number(form.yearEstablished)
          : undefined,
        website: form.website.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        accountName: form.accountName.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
      });
      if (res && res.success === false) {
        throw new Error(res.error || "Update failed");
      }
      toast({ title: "Vendor profile updated successfully" });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        title: "Failed to update vendor profile",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile — {vendorName}</DialogTitle>
          <DialogDescription>
            Update every aspect of this vendor's profile.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <p className="text-sm text-muted-foreground py-4">
            Loading vendor data...
          </p>
        ) : (
          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Company Information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Company Name</Label>
                  <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {VENDOR_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tax ID / TIN</Label>
                  <Input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input type="url" placeholder="https://example.com" value={form.website} onChange={(e) => set("website", e.target.value)} />
                </div>
                <div>
                  <Label>Year Established</Label>
                  <Input type="number" min={1900} max={new Date().getFullYear()} value={form.yearEstablished} onChange={(e) => set("yearEstablished", e.target.value)} />
                </div>
                <div>
                  <Label>Number of Employees</Label>
                  <Input placeholder="e.g. 11-50" value={form.numberOfEmployees} onChange={(e) => set("numberOfEmployees", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Annual Revenue</Label>
                  <Input placeholder="e.g. 1M - 5M" value={form.annualRevenue} onChange={(e) => set("annualRevenue", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Contact Information</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Contact Person</Label>
                  <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
                </div>
                <div>
                  <Label>Contact Title</Label>
                  <Input value={form.contactPersonTitle} onChange={(e) => set("contactPersonTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label>Alternate Phone</Label>
                  <Input value={form.alternatePhone} onChange={(e) => set("alternatePhone", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Address</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Street Address</Label>
                  <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Categories</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                {VENDOR_CATEGORIES.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.categories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
              {form.categories.includes(OTHERS_VENDOR_CATEGORY) && (
                <div>
                  <Label>Specify Other Category</Label>
                  <Input value={form.categoryOther} onChange={(e) => set("categoryOther", e.target.value)} />
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Bank Details</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input value={form.accountName} onChange={(e) => set("accountName", e.target.value)} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || fetching}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}