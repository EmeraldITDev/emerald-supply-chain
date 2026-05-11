import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { materialsMovementsApi } from "@/services/logisticsApi";
import { vendorApi } from "@/services/api";
import type { MaterialMovementRecord, ConditionOfGoods } from "@/types/logistics";
import type { Vendor } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: MaterialMovementRecord | null;
  onSaved?: () => void;
}

const empty = (): Partial<MaterialMovementRecord> => ({
  materialName: "",
  category: "",
  quantity: 0,
  pickupLocation: "",
  destination: "",
  vendorId: null,
  vendorName: "",
  vendorAddress: "",
  vendorPhone: "",
  vehiclePlate: "",
  driverName: "",
  driverPhone: "",
  expectedPickupAt: "",
  expectedDeliveryAt: "",
  conditionOfGoods: "NEW",
});

const toLocal = (iso?: string) => {
  if (!iso) return "";
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const MaterialMovementForm = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<MaterialMovementRecord>>(empty());
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [emeraldOwned, setEmeraldOwned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            ...initial,
            expectedPickupAt: toLocal(initial.expectedPickupAt),
            expectedDeliveryAt: toLocal(initial.expectedDeliveryAt),
          }
        : empty()
    );
    setEmeraldOwned(!!initial && !initial.vendorId && !!initial.vendorName);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setVendorsLoading(true);
    vendorApi
      .getAll({ status: "Active" } as any)
      .then(res => {
        if (!active) return;
        const list: any = res.data;
        const items: Vendor[] = Array.isArray(list)
          ? list
          : Array.isArray(list?.data)
            ? list.data
            : [];
        setVendors(items);
      })
      .finally(() => active && setVendorsLoading(false));
    return () => { active = false; };
  }, [open]);

  const update = <K extends keyof MaterialMovementRecord>(key: K, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const dateError = useMemo(() => {
    if (!form.expectedPickupAt || !form.expectedDeliveryAt) return null;
    return new Date(form.expectedDeliveryAt) <= new Date(form.expectedPickupAt)
      ? "Expected Delivery must be after Expected Pickup."
      : null;
  }, [form.expectedPickupAt, form.expectedDeliveryAt]);

  const phoneOk = (v?: string | null) => !!v && v.replace(/\D/g, "").length >= 10;

  const validate = (): string | null => {
    if (!form.materialName?.trim()) return "Material Name is required.";
    if (!form.category?.trim()) return "Category is required.";
    if (!form.quantity || Number(form.quantity) <= 0) return "Quantity must be > 0.";
    if (!form.pickupLocation?.trim()) return "Pickup Location is required.";
    if (!form.destination?.trim()) return "Destination is required.";
    if (emeraldOwned) {
      if (!form.vendorName?.trim()) return "Vendor Name is required.";
    } else {
      if (!form.vendorId) return "Select a vendor or toggle Emerald-owned.";
    }
    if (!phoneOk(form.vendorPhone)) return "Vendor Phone must have at least 10 digits.";
    if (!form.vehiclePlate?.trim()) return "Vehicle Plate is required.";
    if (!form.driverName?.trim()) return "Driver Name is required.";
    if (!phoneOk(form.driverPhone)) return "Driver Phone must have at least 10 digits.";
    if (!form.expectedPickupAt) return "Expected Pickup is required.";
    if (!form.expectedDeliveryAt) return "Expected Delivery is required.";
    if (dateError) return dateError;
    if (!form.conditionOfGoods) return "Condition of Goods is required.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validation", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<MaterialMovementRecord> = {
        ...form,
        vendorId: emeraldOwned ? null : form.vendorId,
        vendorName: emeraldOwned ? form.vendorName : null,
        vendorAddress: emeraldOwned ? form.vendorAddress || null : null,
        expectedPickupAt: form.expectedPickupAt ? new Date(form.expectedPickupAt).toISOString() : undefined,
        expectedDeliveryAt: form.expectedDeliveryAt ? new Date(form.expectedDeliveryAt).toISOString() : undefined,
        quantity: Number(form.quantity),
      };
      const res = initial
        ? await materialsMovementsApi.update(initial.id, payload)
        : await materialsMovementsApi.create(payload);
      if (res.success) {
        toast({ title: initial ? "Movement updated" : "Movement created" });
        onSaved?.();
        onOpenChange(false);
      } else {
        toast({ title: "Save failed", description: res.error ?? "Try again", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Material Movement" : "New Material Movement"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Material Name *</Label>
            <Input value={form.materialName ?? ""} onChange={e => update("materialName", e.target.value)} placeholder="e.g. HP Branded Laptops" />
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Input value={form.category ?? ""} onChange={e => update("category", e.target.value)} placeholder="e.g. Electronics" />
          </div>
          <div className="space-y-2">
            <Label>Quantity *</Label>
            <Input type="number" min={1} value={form.quantity ?? ""} onChange={e => update("quantity", e.target.value === "" ? 0 : Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Pickup Location *</Label>
            <Input value={form.pickupLocation ?? ""} onChange={e => update("pickupLocation", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Destination *</Label>
            <Input value={form.destination ?? ""} onChange={e => update("destination", e.target.value)} />
          </div>

          <div className="sm:col-span-2 space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="emerald-owned"
                checked={emeraldOwned}
                onCheckedChange={v => {
                  setEmeraldOwned(!!v);
                  if (v) update("vendorId", null);
                  else update("vendorName", "");
                }}
              />
              <Label htmlFor="emerald-owned" className="cursor-pointer">
                Emerald-owned vehicle (no vendor record)
              </Label>
            </div>
            {!emeraldOwned ? (
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select
                  value={form.vendorId ?? ""}
                  onValueChange={v => {
                    update("vendorId", v);
                    const matched = vendors.find(x => String(x.id) === v);
                    if (matched) {
                      update("vendorName", matched.name);
                      update("vendorAddress", matched.address ?? "");
                    }
                  }}
                  disabled={vendorsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={vendorsLoading ? "Loading vendors…" : "Select vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input value={form.vendorName ?? ""} onChange={e => update("vendorName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Address (optional)</Label>
                  <Textarea rows={2} value={form.vendorAddress ?? ""} onChange={e => update("vendorAddress", e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Vendor Phone *</Label>
              <Input type="tel" value={form.vendorPhone ?? ""} onChange={e => update("vendorPhone", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vehicle Plate Number *</Label>
            <Input value={form.vehiclePlate ?? ""} onChange={e => update("vehiclePlate", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Driver Name *</Label>
            <Input value={form.driverName ?? ""} onChange={e => update("driverName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Driver Phone *</Label>
            <Input type="tel" value={form.driverPhone ?? ""} onChange={e => update("driverPhone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Condition of Goods *</Label>
            <Select value={form.conditionOfGoods ?? "NEW"} onValueChange={v => update("conditionOfGoods", v as ConditionOfGoods)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="USED">Used</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected Pickup *</Label>
            <Input type="datetime-local" value={form.expectedPickupAt ?? ""} onChange={e => update("expectedPickupAt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expected Delivery *</Label>
            <Input type="datetime-local" value={form.expectedDeliveryAt ?? ""} onChange={e => update("expectedDeliveryAt", e.target.value)} />
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Create Movement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialMovementForm;
