import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vendorApi } from "@/services/api";
import { toast } from "@/hooks/use-toast";

interface Props {
  vendorId: number;
  vendorName: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
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
  const [form, setForm] = useState({
    annualRevenue: "",
    numberOfEmployees: "",
    yearEstablished: "",
    website: "",
  });

  // Fetch full vendor record when dialog opens
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    vendorApi.getById(String(vendorId))
      .then((res) => {
        const v = res.data;
        setForm({
          annualRevenue: v.annualRevenue ?? "",
          numberOfEmployees: v.numberOfEmployees ?? "",
          yearEstablished: v.yearEstablished ? String(v.yearEstablished) : "",
          website: v.website ?? "",
        });
      })
      .finally(() => setFetching(false));
  }, [open, vendorId]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await vendorApi.updateAdmin(vendorId, {
        annualRevenue: form.annualRevenue || undefined,
        numberOfEmployees: form.numberOfEmployees || undefined,
        yearEstablished: form.yearEstablished
          ? Number(form.yearEstablished)
          : undefined,
        website: form.website || undefined,
      });
      toast({ title: "Vendor profile updated successfully" });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        title: "Failed to update vendor profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile — {vendorName}</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <p className="text-sm text-muted-foreground py-4">
            Loading vendor data...
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label>Annual Revenue</Label>
              <Input
                placeholder="e.g. 5000000"
                value={form.annualRevenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, annualRevenue: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Number of Employees</Label>
              <Input
                placeholder="e.g. 11-50"
                value={form.numberOfEmployees}
                onChange={(e) =>
                  setForm((f) => ({ ...f, numberOfEmployees: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Year Established</Label>
              <Input
                type="number"
                placeholder="e.g. 2015"
                min={1900}
                max={new Date().getFullYear()}
                value={form.yearEstablished}
                onChange={(e) =>
                  setForm((f) => ({ ...f, yearEstablished: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Website</Label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
              />
            </div>
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