import { useState, useEffect } from "react";
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
import { searchApi, GlobalSearchResult } from "@/services/api";
import { getDisplayId } from "@/utils/displayId";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Debounced backend search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.global(searchQuery.trim());
        if (res.success && Array.isArray(res.data)) {
          setResults(res.data);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const getIcon = (type: string) => {
    switch ((type || '').toLowerCase()) {
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
        return Truck;
      default:
        return FileText;
    }
  };

  const getCategory = (type: string): string => {
    const t = (type || '').toLowerCase();
    if (["mrf", "srf", "po", "rfq"].includes(t)) return "Procurement";
    if (t === "vendor") return "Vendors";
    if (t === "item") return "Inventory";
    if (t === "shipment") return "Logistics";
    return "Other";
  };

  const getUrl = (r: GlobalSearchResult): string => {
    const t = (r.type || '').toLowerCase();
    if (["mrf", "srf", "po", "rfq"].includes(t)) return `/procurement?id=${r.id}`;
    if (t === "vendor") return `/vendors?id=${r.id}`;
    if (t === "item") return `/inventory?id=${r.id}`;
    if (t === "shipment") return `/logistics?id=${r.id}`;
    return "/dashboard";
  };

  const handleSelect = (url: string) => {
    setOpen(false);
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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search MRFs, vendors, items, shipments..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching..." : searchQuery ? "No results found." : "Type to search..."}
          </CommandEmpty>
          {results.length > 0 && (
            <>
              {["Procurement", "Vendors", "Inventory", "Logistics", "Other"].map((category) => {
                const categoryResults = results.filter(
                  (result) => getCategory(result.type) === category
                );
                
                if (categoryResults.length === 0) return null;

                return (
                  <CommandGroup key={category} heading={category}>
                    {categoryResults.map((result) => {
                      const Icon = getIcon(result.type);
                      const display = getDisplayId(result);
                      return (
                        <CommandItem
                          key={result.id}
                          value={`${display} ${result.title}`}
                          onSelect={() => handleSelect(getUrl(result))}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.title}</span>
                            <span className="text-xs text-muted-foreground">{display}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
