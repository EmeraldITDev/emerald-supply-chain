import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputWithIcon } from "@/components/ui/input-with-icon";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type ListControlsState,
  type ListSort,
  countActiveListFilters,
  defaultListControls,
} from "@/utils/listFilters";

export interface StatusOption {
  label: string;
  value: string;
}

interface ListControlsProps {
  state: ListControlsState;
  onChange: (next: ListControlsState) => void;
  statusOptions: StatusOption[];
  searchPlaceholder?: string;
}

const SORT_OPTIONS: { label: string; value: ListSort }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Highest value", value: "value-desc" },
  { label: "Lowest value", value: "value-asc" },
];

/**
 * Reusable search + status + date-range + sort control bar for list views.
 * Controlled via a single ListControlsState object.
 */
export function ListControls({
  state,
  onChange,
  statusOptions,
  searchPlaceholder = "Search...",
}: ListControlsProps) {
  const set = (patch: Partial<ListControlsState>) =>
    onChange({ ...state, ...patch });

  const activeCount = countActiveListFilters(state);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <InputWithIcon
          icon={<Search className="h-4 w-4" />}
          placeholder={searchPlaceholder}
          value={state.search}
          onChange={(e) => set({ search: e.target.value })}
          className="w-full"
        />
      </div>

      <Select value={state.status} onValueChange={(v) => set({ status: v })}>
        <SelectTrigger className="w-full sm:w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={state.sort}
        onValueChange={(v) => set({ sort: v as ListSort })}
      >
        <SelectTrigger className="w-full sm:w-[170px]">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <SelectValue placeholder="Sort" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Date range
            {activeCount > 0 && (
              <Badge className="ml-2 flex h-5 w-5 items-center justify-center rounded-full p-0">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Date range</h4>
              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() =>
                    onChange({
                      ...defaultListControls(),
                      search: state.search,
                      sort: state.sort,
                    })
                  }
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-date-from">From</Label>
              <Input
                id="list-date-from"
                type="date"
                value={state.dateFrom}
                max={state.dateTo || undefined}
                onChange={(e) => set({ dateFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-date-to">To</Label>
              <Input
                id="list-date-to"
                type="date"
                value={state.dateTo}
                min={state.dateFrom || undefined}
                onChange={(e) => set({ dateTo: e.target.value })}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
