import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, X, Hotel, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { accommodationApi, tripsApi } from "@/services/logisticsApi";
import type { Accommodation, Trip, CreateAccommodationData } from "@/types/logistics";

const CRUD_ROLES = ["logistics_officer", "logistics_manager", "logistics", "admin"];
const READ_ROLES = ["supply_chain_director", "supply_chain", "procurement_manager", "procurement"];

const normalize = (raw: any): Accommodation => ({
  id: String(raw.id),
  passengerNames: Array.isArray(raw.passenger_names ?? raw.passengerNames)
    ? (raw.passenger_names ?? raw.passengerNames)
    : typeof raw.passenger_names === "string"
      ? raw.passenger_names.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
  destinationState: raw.destination_state ?? raw.destinationState ?? "",
  destinationCity: raw.destination_city ?? raw.destinationCity ?? "",
  numberOfNights: Number(raw.number_of_nights ?? raw.numberOfNights ?? 0),
  hotelName: raw.hotel_name ?? raw.hotelName ?? "",
  checkInDate: raw.check_in_date ?? raw.checkInDate ?? "",
  checkOutDate: raw.check_out_date ?? raw.checkOutDate,
  linkedTripId: raw.linked_trip_id?.toString() ?? raw.linkedTripId,
  linkedTripNumber: raw.linked_trip?.trip_code ?? raw.linkedTripNumber,
  createdAt: raw.created_at ?? raw.createdAt,
  updatedAt: raw.updated_at ?? raw.updatedAt,
});

const computeCheckOut = (checkIn: string, nights: number) => {
  if (!checkIn || !nights || nights <= 0) return "";
  const d = new Date(checkIn);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(nights));
  return d.toISOString().slice(0, 10);
};

export function AccommodationBookings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user?.role as string) ?? "";
  const canCrud = CRUD_ROLES.includes(role);
  const canRead = canCrud || READ_ROLES.includes(role);

  const [items, setItems] = useState<Accommodation[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Accommodation | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Form
  const [passengerInput, setPassengerInput] = useState("");
  const [form, setForm] = useState<CreateAccommodationData>({
    passengerNames: [],
    destinationState: "",
    destinationCity: "",
    numberOfNights: 1,
    hotelName: "",
    checkInDate: "",
    linkedTripId: undefined,
  });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [a, t] = await Promise.all([accommodationApi.list(), tripsApi.getAll()]);
    if (a.success && Array.isArray(a.data)) setItems(a.data.map(normalize));
    else setItems([]);
    if (t.success && Array.isArray(t.data)) setTrips(t.data as Trip[]);
    setLoading(false);
  };

  useEffect(() => {
    if (canRead) fetchAll();
    const handler = () => canRead && fetchAll();
    window.addEventListener("app:refresh", handler);
    return () => window.removeEventListener("app:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const q = search.toLowerCase();
      if (q && !(
        it.hotelName.toLowerCase().includes(q) ||
        it.destinationCity.toLowerCase().includes(q) ||
        it.destinationState.toLowerCase().includes(q) ||
        it.passengerNames.join(",").toLowerCase().includes(q)
      )) return false;
      if (tripFilter !== "all" && it.linkedTripId !== tripFilter) return false;
      if (from && it.checkInDate < from) return false;
      if (to && it.checkInDate > to) return false;
      return true;
    });
  }, [items, search, tripFilter, from, to]);

  const resetForm = () => {
    setEditing(null);
    setPassengerInput("");
    setForm({
      passengerNames: [],
      destinationState: "",
      destinationCity: "",
      numberOfNights: 1,
      hotelName: "",
      checkInDate: "",
      linkedTripId: undefined,
    });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (item: Accommodation) => {
    setEditing(item);
    setPassengerInput("");
    setForm({
      passengerNames: item.passengerNames,
      destinationState: item.destinationState,
      destinationCity: item.destinationCity,
      numberOfNights: item.numberOfNights,
      hotelName: item.hotelName,
      checkInDate: item.checkInDate?.slice(0, 10) ?? "",
      linkedTripId: item.linkedTripId,
    });
    setDialogOpen(true);
  };

  const addPassenger = () => {
    const v = passengerInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, passengerNames: [...f.passengerNames, v] }));
    setPassengerInput("");
  };

  const removePassenger = (idx: number) => {
    setForm((f) => ({ ...f, passengerNames: f.passengerNames.filter((_, i) => i !== idx) }));
  };

  const validate = () => {
    if (form.passengerNames.length === 0) return "At least one passenger name required";
    if (!form.destinationState.trim()) return "Destination state required";
    if (!form.destinationCity.trim()) return "Destination city required";
    if (!form.numberOfNights || form.numberOfNights < 1) return "Number of nights must be ≥ 1";
    if (!form.hotelName.trim()) return "Hotel name required";
    if (!form.checkInDate) return "Check-in date required";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Missing information", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = editing
      ? await accommodationApi.update(editing.id, form)
      : await accommodationApi.create(form);
    setSaving(false);
    if (res.success) {
      toast({ title: editing ? "Booking updated" : "Booking created" });
      setDialogOpen(false);
      resetForm();
      window.dispatchEvent(new CustomEvent("app:refresh"));
      fetchAll();
    } else {
      toast({ title: "Save failed", description: res.error, variant: "destructive" });
    }
  };

  const remove = async (item: Accommodation) => {
    if (!confirm(`Delete booking at ${item.hotelName}?`)) return;
    const res = await accommodationApi.remove(item.id);
    if (res.success) {
      toast({ title: "Booking deleted" });
      window.dispatchEvent(new CustomEvent("app:refresh"));
      fetchAll();
    } else {
      toast({ title: "Delete failed", description: res.error, variant: "destructive" });
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          You do not have access to accommodation bookings.
        </CardContent>
      </Card>
    );
  }

  const checkOutPreview = computeCheckOut(form.checkInDate, form.numberOfNights);

  return (
    <div className="space-y-4 w-full min-w-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5" /> Accommodation Bookings
            </CardTitle>
            <CardDescription>
              Hotel bookings for personnel travel{!canCrud && " (read-only)"}
            </CardDescription>
          </div>
          {canCrud && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> New Booking
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hotel, city, passenger…"
                className="pl-9"
              />
            </div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
            <Select value={tripFilter} onValueChange={setTripFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by trip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trips</SelectItem>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.tripNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passenger(s)</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Linked Trip</TableHead>
                  {canCrud && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={canCrud ? 7 : 6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canCrud ? 7 : 6} className="text-center text-muted-foreground py-8">
                    No bookings found
                  </TableCell></TableRow>
                ) : (
                  filtered.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {it.passengerNames.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{it.destinationCity}, {it.destinationState}</TableCell>
                      <TableCell className="text-sm font-medium">{it.hotelName}</TableCell>
                      <TableCell className="text-sm">{it.checkInDate?.slice(0, 10)}</TableCell>
                      <TableCell className="text-sm">{it.numberOfNights}</TableCell>
                      <TableCell className="text-sm">
                        {it.linkedTripNumber ?? (it.linkedTripId ? trips.find(t => t.id === it.linkedTripId)?.tripNumber : "—")}
                      </TableCell>
                      {canCrud && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(it)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Booking" : "New Accommodation Booking"}</DialogTitle>
            <DialogDescription>
              Hotel name is free text; check-out date is calculated from check-in + nights.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Passenger Name(s) *</Label>
              <div className="flex gap-2">
                <Input
                  value={passengerInput}
                  onChange={(e) => setPassengerInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPassenger(); } }}
                  placeholder="Type name and press Enter"
                />
                <Button type="button" variant="outline" onClick={addPassenger}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {form.passengerNames.map((p, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {p}
                    <button type="button" onClick={() => removePassenger(i)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Destination State *</Label>
                <Input value={form.destinationState} onChange={(e) => setForm({ ...form, destinationState: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Destination City *</Label>
                <Input value={form.destinationCity} onChange={(e) => setForm({ ...form, destinationCity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hotel Name *</Label>
                <Input value={form.hotelName} onChange={(e) => setForm({ ...form, hotelName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Number of Nights *</Label>
                <Input
                  type="number" min={1}
                  value={form.numberOfNights}
                  onChange={(e) => setForm({ ...form, numberOfNights: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Check-in Date *</Label>
                <Input type="date" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Check-out Date (auto)</Label>
                <Input value={checkOutPreview || "—"} readOnly className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Linked Trip</Label>
              <Select
                value={form.linkedTripId ?? "__none__"}
                onValueChange={(v) => setForm({ ...form, linkedTripId: v === "__none__" ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tripNumber} — {t.origin} → {t.destination}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Link this booking to an existing trip schedule.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editing ? "Save Changes" : "Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}