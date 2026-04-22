import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vendorApi } from "@/services/api";

interface VendorProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string | number | null;
  vendorName?: string;
  onSaved?: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

const VendorProfileEditDialog = ({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  onSaved,
}: VendorProfileEditDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [numberOfEmployees, setNumberOfEmployees] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [website, setWebsite] = useState("");

  // Fetch full vendor record on open — list cache may omit these fields.
  useEffect(() => {
    if (!open || !vendorId) return;
    let cancelled = false;
    setLoading(true);
    vendorApi
      .getById(String(vendorId))
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const v: any = res.data;
          setAnnualRevenue(v.annual_revenue ?? v.annualRevenue ?? "");
          setNumberOfEmployees(v.number_of_employees ?? v.numberOfEmployees ?? "");
          setYearEstablished(
            v.year_established != null
              ? String(v.year_established)
              : v.yearEstablished != null
              ? String(v.yearEstablished)
              : "",
          );
          setWebsite(v.website ?? "");
        } else {
          toast({
            title: "Failed to load vendor",
            description: res.error || "Could not fetch vendor profile.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vendorId, toast]);

  const handleSave = async () => {
    if (!vendorId) return;

    // Validate year if provided
    if (yearEstablished.trim()) {
      const yr = Number(yearEstablished);
      if (!Number.isInteger(yr) || yr < 1900 || yr > CURRENT_YEAR) {
        toast({
          title: "Invalid year",
          description: `Year established must be between 1900 and ${CURRENT_YEAR}.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validate URL if provided
    if (website.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(website.trim());
      } catch {
        toast({
          title: "Invalid website",
          description: "Website must be a valid URL (include https://).",
          variant: "destructive",
        });
        return;
      }
    }

    const payload: {
      annual_revenue?: string;
      number_of_employees?: string;
      year_established?: number;
      website?: string;
    } = {};
    if (annualRevenue.trim()) payload.annual_revenue = annualRevenue.trim();
    if (numberOfEmployees.trim()) payload.number_of_employees = numberOfEmployees.trim();
    if (yearEstablished.trim()) payload.year_established = Number(yearEstablished);
    if (website.trim()) payload.website = website.trim();

    setSaving(true);
    try {
      const res = await vendorApi.updateAdmin(String(vendorId), payload);
      if (res.success) {
        toast({
          title: "Profile updated",
          description: "Vendor profile details saved successfully.",
        });
        onSaved?.();
        onOpenChange(false);
      } else {
        toast({
          title: "Update failed",
          description: res.error || "Could not save vendor profile.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile Details</DialogTitle>
          <DialogDescription>
            {vendorName ? `Backfill missing profile fields for ${vendorName}.` : "Backfill missing profile fields."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading vendor profile…</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="annual_revenue">Annual Revenue</Label>
              <Input
                id="annual_revenue"
                placeholder="e.g. 5,000,000"
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">Stored as text. Use the format the vendor reports.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="number_of_employees">Number of Employees</Label>
              <Input
                id="number_of_employees"
                placeholder="e.g. 250 or 11-50"
                value={numberOfEmployees}
                onChange={(e) => setNumberOfEmployees(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">Free text — exact count or range label.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year_established">Year Established</Label>
              <Input
                id="year_established"
                type="number"
                min={1900}
                max={CURRENT_YEAR}
                placeholder="e.g. 2015"
                value={yearEstablished}
                onChange={(e) => setYearEstablished(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://company.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={255}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorProfileEditDialog;