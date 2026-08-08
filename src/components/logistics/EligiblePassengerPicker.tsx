import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { passengerApi } from "@/services/api";
import type { EligiblePassenger } from "@/types/logistics";

export interface PreselectedPassenger {
  id: string | number;
  name?: string;
  department?: string;
}

interface EligiblePassengerPickerProps {
  selectedPassengerIds: string[];
  onPassengersChange: (ids: string[]) => void;
  driverUserId?: string;
  onDriverChange?: (id: string | undefined) => void;
  showDriver?: boolean;
  /**
   * Passengers already attached to the record being edited. They are always
   * rendered (and checked) even when the eligible-staff endpoint does not
   * return them — this is what caused "2 passengers selected" to sit next to
   * "No eligible passengers found".
   */
  preselectedPassengers?: PreselectedPassenger[];
  /** Overrides for reuse in driver-selection context (e.g. "Select Driver"). */
  label?: string;
  emptyLabel?: string;
  placeholder?: string;
  selectedSuffix?: string;
}

export function EligiblePassengerPicker({
  selectedPassengerIds,
  onPassengersChange,
  driverUserId,
  onDriverChange,
  showDriver = true,
  preselectedPassengers = [],
  label = "Select Passengers",
  emptyLabel = "No eligible passengers found.",
  placeholder = "Search by name or department...",
  selectedSuffix = "passenger(s) selected",
}: EligiblePassengerPickerProps) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<EligiblePassenger[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await passengerApi.getEligible(q || undefined, 1);
      if (res.success && res.data) {
        const payload = res.data as { users?: EligiblePassenger[] } | EligiblePassenger[];
        const usersList = Array.isArray(payload)
          ? payload
          : payload.users || [];
        setUsers(usersList);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  const toggle = (id: number | string) => {
    const sid = String(id);
    if (selectedPassengerIds.includes(sid)) {
      onPassengersChange(selectedPassengerIds.filter((x) => x !== sid));
    } else {
      onPassengersChange([...selectedPassengerIds, sid]);
    }
  };

  // Merge the directory results with the record's existing passengers so a
  // selected passenger is never invisible.
  const visibleUsers = (() => {
    const byId = new Map<string, { id: string; name: string; department?: string; role?: string }>();
    for (const p of preselectedPassengers) {
      const id = String(p.id);
      if (!id) continue;
      byId.set(id, { id, name: p.name?.trim() || `Staff #${id}`, department: p.department });
    }
    for (const u of users) {
      byId.set(String(u.id), {
        id: String(u.id),
        name: u.name,
        department: u.department,
        role: u.role,
      });
    }
    const q = search.trim().toLowerCase();
    const all = Array.from(byId.values());
    if (!q) return all;
    return all.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q) ||
        selectedPassengerIds.includes(u.id),
    );
  })();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
          {loading && visibleUsers.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading staff...
            </div>
          ) : visibleUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">{emptyLabel}</p>
          ) : (
            visibleUsers.map((u) => (
              <div key={u.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`passenger-${u.id}`}
                  checked={selectedPassengerIds.includes(u.id)}
                  onCheckedChange={() => toggle(u.id)}
                />
                <label htmlFor={`passenger-${u.id}`} className="text-sm cursor-pointer flex-1">
                  {u.name}{" "}
                  <span className="text-muted-foreground">
                    ({u.department || u.role || "—"})
                  </span>
                </label>
              </div>
            ))
          )}
        </div>
        {selectedPassengerIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedPassengerIds.length} {selectedSuffix}
          </p>
        )}
      </div>

      {showDriver && onDriverChange && (
        <div className="space-y-2">
          <Label>Driver (optional)</Label>
          <Select
            value={driverUserId || "none"}
            onValueChange={(v) => onDriverChange(v === "none" ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              <SelectItem value="none">No driver assigned</SelectItem>
              {visibleUsers.map((u) => (
                <SelectItem key={`driver-${u.id}`} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
