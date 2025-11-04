import { useState } from "react";
import { Calendar, User, Activity, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  status: "success" | "failed" | "pending";
}

const mockAuditData: AuditEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15 14:30:25",
    user: "john.doe@emeraldcfze.com",
    action: "Created MRF",
    module: "Procurement",
    details: "MRF-2024-001 - Office Supplies",
    ipAddress: "192.168.1.100",
    status: "success"
  },
  {
    id: "2",
    timestamp: "2024-01-15 14:25:18",
    user: "procurement@emeraldcfze.com",
    action: "Approved PO",
    module: "Procurement",
    details: "PO-2024-045 - Total: $15,000",
    ipAddress: "192.168.1.105",
    status: "success"
  },
  {
    id: "3",
    timestamp: "2024-01-15 14:20:45",
    user: "finance@emeraldcfze.com",
    action: "Updated Budget",
    module: "Finance",
    details: "Project Alpha - Q1 2024 Budget",
    ipAddress: "192.168.1.110",
    status: "success"
  },
  {
    id: "4",
    timestamp: "2024-01-15 14:15:32",
    user: "warehouse@emeraldcfze.com",
    action: "Stock Adjustment",
    module: "Inventory",
    details: "INV-2024-089 - Quantity: -50",
    ipAddress: "192.168.1.115",
    status: "success"
  },
  {
    id: "5",
    timestamp: "2024-01-15 14:10:12",
    user: "admin@emeraldcfze.com",
    action: "Login Failed",
    module: "System",
    details: "Invalid credentials",
    ipAddress: "203.45.67.89",
    status: "failed"
  },
];

export function AuditTrail() {
  const [entries] = useState<AuditEntry[]>(mockAuditData);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = moduleFilter === "all" || entry.module === moduleFilter;
    const matchesAction = actionFilter === "all" || entry.action.includes(actionFilter);

    return matchesSearch && matchesModule && matchesAction;
  });

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-success">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>
          Complete activity log with filters and search
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by user, action, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by module" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Modules</SelectItem>
              <SelectItem value="Procurement">Procurement</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="Inventory">Inventory</SelectItem>
              <SelectItem value="System">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="Created">Created</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Updated">Updated</SelectItem>
              <SelectItem value="Deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No audit entries found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.timestamp}</TableCell>
                    <TableCell className="text-sm">{entry.user}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.action}</Badge>
                    </TableCell>
                    <TableCell>{entry.module}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {entry.details}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.ipAddress}</TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>
    </Card>
  );
}
