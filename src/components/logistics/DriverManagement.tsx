import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Phone } from "lucide-react";
import { driversApi } from "@/services/logisticsApi";
import { useToast } from "@/hooks/use-toast";
import type { Driver } from "@/types/logistics";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (raw: any): Driver => ({
  id: raw.id?.toString(),
  name: raw.name || "",
  email: raw.email || undefined,
  phoneNumber: raw.phone_number || raw.phoneNumber || "",
  licenceNumber: raw.licence_number || raw.licenceNumber,
  status: raw.status || "active",
});

const phoneDigits = (v: string) => (v || "").replace(/\D/g, "");

export const DriverManagement = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone_number: "", licence_number: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await driversApi.list();
      if (res.success && res.data) {
        const arr = Array.isArray(res.data) ? res.data : (res.data as any).drivers || [];
        setDrivers(arr.map(normalize));
      } else {
        setDrivers([]);
        if (res.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone_number: "", licence_number: "" });
    setDialogOpen(true);
  };

  const openEdit = (d: Driver) => {
    setEditing(d);
    setForm({
      name: d.name,
      email: d.email || "",
      phone_number: d.phoneNumber || "",
      licence_number: d.licenceNumber || "",
    });
    setDialogOpen(true);
  };

  const phoneOk = phoneDigits(form.phone_number).length >= 10;
  const emailOk = !form.email || EMAIL_RE.test(form.email);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!phoneOk) {
      toast({ title: "Phone number invalid", description: "At least 10 digits required.", variant: "destructive" });
      return;
    }
    if (!emailOk) {
      toast({ title: "Email invalid", description: "Provide a valid email or leave it blank.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone_number: form.phone_number.trim(),
        licence_number: form.licence_number.trim() || undefined,
      };
      const res = editing
        ? await driversApi.update(editing.id, body)
        : await driversApi.create(body);
      if (res.success) {
        toast({ title: editing ? "Driver Updated" : "Driver Added" });
        setDialogOpen(false);
        fetchData();
      } else {
        toast({ title: "Save Failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Drivers</h3>
          <p className="text-xs text-muted-foreground">Manage fleet drivers and contact details.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Driver
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
          </AlertDescription>
        </Alert>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No drivers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Licence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    {d.phoneNumber ? (
                      <a href={`tel:${d.phoneNumber}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3 w-3" /> {d.phoneNumber}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{d.email || "—"}</TableCell>
                  <TableCell>{d.licenceNumber || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {d.status || "active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Driver" : "Add Driver"}</DialogTitle>
            <DialogDescription>Driver records used for trip assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number *</Label>
              <Input
                type="tel"
                placeholder="e.g. 08012345678"
                value={form.phone_number}
                onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
              />
              {!phoneOk && form.phone_number && (
                <p className="text-xs text-destructive">At least 10 digits required.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="optional@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Optional — only if the driver has a work email address.</p>
              {!emailOk && (
                <p className="text-xs text-destructive">Invalid email format.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Licence Number</Label>
              <Input value={form.licence_number} onChange={(e) => setForm((p) => ({ ...p, licence_number: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverManagement;