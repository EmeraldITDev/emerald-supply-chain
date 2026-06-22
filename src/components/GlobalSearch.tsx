import { useState, useEffect, useCallback, useRef } from "react";
import { Search, FileText, Package, Users, Truck, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  searchApi,
  GlobalSearchResult,
  mrfApi,
  srfApi,
  vendorApi,
} from "@/services/api";
import { getDisplayId } from "@/utils/displayId";

type SearchItem = GlobalSearchResult & {
  /** Extra haystack text for client-side matching (vendor, requester, etc.). */
  _keywords?: string;
};

const CATEGORY_ORDER = ["Procurement", "Vendors", "Inventory", "Logistics", "Other"];

function dedupe(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  const out: SearchItem[] = [];
  for (const it of items) {
    const key = `${(it.type || "").toLowerCase()}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const navigate = useNavigate();

  // Local index, prefetched once when the palette opens so search works even if
  // the backend /search endpoint is missing or partial.
  const localIndexRef = useRef<SearchItem[] | null>(null);
  const indexLoadingRef = useRef(false);

  const buildLocalIndex = useCallback(async () => {
    if (localIndexRef.current || indexLoadingRef.current) return;
    indexLoadingRef.current = true;
    try {
      const [mrfRes, srfRes, vendorRes] = await Promise.all([
        mrfApi.getAll().catch(() => null),
        srfApi.getAll().catch(() => null),
        vendorApi.getAll().catch(() => null),
      ]);

      const index: SearchItem[] = [];

      const mrfs = mrfRes?.success && Array.isArray(mrfRes.data) ? mrfRes.data : [];
      for (const m of mrfs as Array<Record<string, unknown>>) {
        const vendor = String(
          m.vendor_name ?? m.vendorName ?? m.selectedVendorName ?? "",
        );
        const requester = String(m.requester_name ?? m.requester ?? "");
        index.push({
          id: String(m.id ?? ""),
          formatted_id: m.formatted_id as string | undefined,
          formattedId: m.formattedId as string | undefined,
          legacy_id: m.legacy_id as string | undefined,
          title: String(m.title ?? "Untitled MRF"),
          type: "mrf",
          _keywords: `${vendor} ${requester}`,
        });
        // Derive a PO entry when the MRF has a PO number.
        const poNumber = String(m.po_number ?? m.poNumber ?? "");
        if (poNumber) {
          index.push({
            id: String(m.id ?? ""),
            formatted_id: poNumber,
            title: `${poNumber} — ${String(m.title ?? "")}`.trim(),
            type: "po",
            _keywords: `${vendor} ${requester} ${poNumber}`,
          });
        }
      }

      const srfs = srfRes?.success && Array.isArray(srfRes.data) ? srfRes.data : [];
      for (const s of srfs as Array<Record<string, unknown>>) {
        const requester = String(s.requester_name ?? s.requester ?? "");
        index.push({
          id: String(s.id ?? ""),
          formatted_id: s.formatted_id as string | undefined,
          formattedId: s.formattedId as string | undefined,
          legacy_id: s.legacy_id as string | undefined,
          title: String(s.title ?? "Untitled SRF"),
          type: "srf",
          _keywords: requester,
        });
      }

      const vendors =
        vendorRes?.success && Array.isArray(vendorRes.data) ? vendorRes.data : [];
      for (const v of vendors as Array<Record<string, unknown>>) {
        index.push({
          id: String(v.id ?? ""),
          formatted_id: v.formatted_id as string | undefined,
          title: String(v.name ?? v.vendor_name ?? "Vendor"),
          type: "vendor",
          _keywords: String(v.email ?? v.contact_email ?? v.category ?? ""),
        });
      }

      localIndexRef.current = index;
    } finally {
      indexLoadingRef.current = false;
    }
  }, []);

  const searchLocalIndex = useCallback((q: string): SearchItem[] => {
    const idx = localIndexRef.current;
    if (!idx) return [];
    const needle = q.toLowerCase();
    return idx
      .filter((it) => {
        const hay = `${it.title} ${getDisplayId(it)} ${it.formatted_id ?? ""} ${
          it._keywords ?? ""
        }`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 40);
  }, []);

  // Prefetch the local index as soon as the palette opens.
  useEffect(() => {
    if (open) void buildLocalIndex();
  }, [open, buildLocalIndex]);

  // Debounced search: backend first, then merge with local index results.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setErrored(false);
      return;
    }
    const q = searchQuery.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      setErrored(false);
      let backend: SearchItem[] = [];
      let backendFailed = false;
      try {
        const res = await searchApi.global(q);
        if (res.success && Array.isArray(res.data)) {
          backend = res.data as SearchItem[];
        } else {
          backendFailed = true;
        }
      } catch {
        backendFailed = true;
      }

      // Always also search the local index so results are resilient.
      await buildLocalIndex();
      const local = searchLocalIndex(q);

      const merged = dedupe([...backend, ...local]);
      setResults(merged);
      setErrored(backendFailed && merged.length === 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, buildLocalIndex, searchLocalIndex]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const getIcon = (type: string) => {
    switch ((type || "").toLowerCase()) {
      case "mrf":
      case "srf":
      case "po":
      case "rfq":
        return ShoppingCart;
      case "vendor":
        return Users;
      case "item":
        return Package;
      case "shipment":
      case "trip":
        return Truck;
      default:
        return FileText;
    }
  };

  const getCategory = (type: string): string => {
    const t = (type || "").toLowerCase();
    if (["mrf", "srf", "po", "rfq"].includes(t)) return "Procurement";
    if (t === "vendor") return "Vendors";
    if (t === "item") return "Inventory";
    if (["shipment", "trip"].includes(t)) return "Logistics";
    return "Other";
  };

  const getUrl = (r: SearchItem): string => {
    const t = (r.type || "").toLowerCase();
    const displayId = getDisplayId(r) || r.id;
    if (t === "mrf") return `/mrfs/${encodeURIComponent(r.id)}`;
    if (t === "po") return `/pos/${encodeURIComponent(r.id)}`;
    if (t === "rfq") return `/rfqs/${encodeURIComponent(r.id)}`;
    // SRF has no standalone detail route — deep-link into Procurement.
    if (t === "srf")
      return `/procurement?tab=srf&srf=${encodeURIComponent(displayId)}`;
    if (t === "vendor") return `/vendors/${encodeURIComponent(r.id)}`;
    if (t === "item") return `/inventory?id=${encodeURIComponent(r.id)}`;
    if (["shipment", "trip"].includes(t))
      return `/trips/${encodeURIComponent(r.id)}`;
    return "/dashboard";
  };

  const handleSelect = (url: string) => {
    setOpen(false);
    setSearchQuery("");
    navigate(url);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search everything...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* shouldFilter={false}: we already filter server-side + via the local
          index, so cmdk's built-in filtering must not hide our results. */}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search MRFs, SRFs, POs, vendors..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading
              ? "Searching..."
              : errored
                ? "Search is temporarily unavailable. Please try again."
                : searchQuery
                  ? "No results found."
                  : "Type to search..."}
          </CommandEmpty>
          {results.length > 0 &&
            CATEGORY_ORDER.map((category) => {
              const categoryResults = results.filter(
                (result) => getCategory(result.type) === category,
              );
              if (categoryResults.length === 0) return null;

              return (
                <CommandGroup key={category} heading={category}>
                  {categoryResults.map((result, i) => {
                    const Icon = getIcon(result.type);
                    const display = getDisplayId(result);
                    const typeLabel = (result.type || "").toUpperCase();
                    return (
                      <CommandItem
                        key={`${result.type}:${result.id}:${i}`}
                        value={`${result.type}:${result.id}:${display} ${result.title}`}
                        onSelect={() => handleSelect(getUrl(result))}
                      >
                        <Icon className="mr-2 h-4 w-4 shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{result.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {typeLabel}
                            {display ? ` · ${display}` : ""}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
