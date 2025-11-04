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

interface SearchResult {
  id: string;
  title: string;
  type: "mrf" | "srf" | "po" | "vendor" | "item" | "shipment";
  category: string;
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Mock search results - replace with actual API call
  const mockResults: SearchResult[] = [
    { id: "MRF001", title: "Office Supplies Request", type: "mrf", category: "Procurement", url: "/procurement?id=MRF001" },
    { id: "SRF001", title: "IT Support Service", type: "srf", category: "Procurement", url: "/procurement?id=SRF001" },
    { id: "PO001", title: "Purchase Order - Laptops", type: "po", category: "Procurement", url: "/procurement?id=PO001" },
    { id: "V001", title: "Tech Solutions LLC", type: "vendor", category: "Vendors", url: "/vendors?id=V001" },
    { id: "ITEM001", title: "HP Laptop ProBook 450", type: "item", category: "Inventory", url: "/inventory?id=ITEM001" },
    { id: "SHIP001", title: "Delivery to Site A", type: "shipment", category: "Logistics", url: "/logistics?id=SHIP001" },
  ];

  const filteredResults = searchQuery
    ? mockResults.filter((result) =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

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
    switch (type) {
      case "mrf":
      case "srf":
      case "po":
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
          <CommandEmpty>No results found.</CommandEmpty>
          {filteredResults.length > 0 && (
            <>
              {["Procurement", "Vendors", "Inventory", "Logistics"].map((category) => {
                const categoryResults = filteredResults.filter(
                  (result) => result.category === category
                );
                
                if (categoryResults.length === 0) return null;

                return (
                  <CommandGroup key={category} heading={category}>
                    {categoryResults.map((result) => {
                      const Icon = getIcon(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          value={`${result.id} ${result.title}`}
                          onSelect={() => handleSelect(result.url)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.title}</span>
                            <span className="text-xs text-muted-foreground">{result.id}</span>
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
