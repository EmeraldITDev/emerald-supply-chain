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

interface EligiblePassengerPickerProps {
  selectedPassengerIds: string[];
  onPassengersChange: (ids: string[]) => void;
  driverUserId?: string;
  onDriverChange?: (id: string | undefined) => void;
  showDriver?: boolean;
}

export function EligiblePassengerPicker({
  selectedPassengerIds,
  onPassengersChange,
  driverUserId,
  onDriverChange,
  showDriver = true,
}: EligiblePassengerPickerProps) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<EligiblePassenger[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await passengerApi.getEligible(q || undefined, 1);
      if (res.success && res.data) {
        const payload = res.data as { users?: EligiblePassenger[] };
        setUsers(payload.users || []);
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

  const toggle = (id: number) => {
    const sid = String(id);
    if (selectedPassengerIds.includes(sid)) {
      onPassengersChange(selectedPassengerIds.filter((x) => x !== sid));
    } else {
      onPassengersChange([...selectedPassengerIds, sid]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Passengers</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading staff...
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No eligible passengers found.</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`passenger-${u.id}`}
                  checked={selectedPassengerIds.includes(String(u.id))}
                  onCheckedChange={() => toggle(u.id)}
                />
                <label htmlFor={`passenger-${u.id}`} className="text-sm cursor-pointer flex-1">
                  {u.name}{" "}
                  <span className="text-muted-foreground">
                    ({u.department || u.role})
                  </span>
                </label>
              </div>
            ))
          )}
        </div>
        {selectedPassengerIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedPassengerIds.length} passenger(s) selected
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
            <SelectContent>
              <SelectItem value="none">No driver assigned</SelectItem>
              {users.map((u) => (
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
