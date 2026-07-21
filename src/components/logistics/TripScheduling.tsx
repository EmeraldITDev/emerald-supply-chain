import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Users,
  Truck,
  MoreHorizontal,
  Eye,
  Edit,
  XCircle,
  
  UserPlus,
  Package,
  Loader2,
  RefreshCw,
  FileCheck,
  Mail,
  Bell,
  BedDouble,
  ShieldCheck,
  Plane,
  Car,
} from "lucide-react";
import { Hotel, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TripVendorComparison } from "./TripVendorComparison";
import { JCCDialog } from "./JCCDialog";
import { Users2, FileSignature } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPoAmount } from "@/utils/currency";
import { tripsApi, logisticsDashboardApi, logisticsVendorsApi } from "@/services/logisticsApi";
import { useAuth } from "@/contexts/AuthContext";
import { tripRequestApi } from "@/services/api";
import { TripRequestDialog } from "./TripRequestDialog";
import { TripWorkflowActions } from "./TripWorkflowActions";
import { TripRequestWorkflowActions } from "./TripRequestWorkflowActions";
import type { StaffTripRequest } from "@/types/trip-request";
import { ServerPaginationBar } from "@/components/ui/ServerPaginationBar";
import type { PaginationMeta } from "@/types/pagination";
import { useTableExport } from "@/hooks/useTableExport";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { TRIP_EXPORT_COLUMNS, type TripExportRow } from "@/config/tableExportPresets";
import { EligiblePassengerPicker } from "./EligiblePassengerPicker";
import type { Trip, TripStatus, TripType, TripPassenger, CreateTripData, BulkTripUploadResult } from "@/types/logistics";
import { VendorJMPSubmission } from "./VendorJMPSubmission";
import { PassengerNotification } from "./PassengerNotification";
import { CSVImportPreview, type CSVColumn } from "./CSVImportPreview";
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

interface TripSchedulingProps {
  onViewTrip?: (trip: Trip) => void;
  onEditTrip?: (trip: Trip) => void;
}

// Vendor and staff lists will be fetched from API

const statusColors: Record<TripStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-warning/10 text-warning",
  vendor_assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  pending_approval: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

interface VendorItem {
  id: string;
  name: string;
  contact?: string;
  vehicles?: number;
}

export const TripScheduling = ({ onViewTrip, onEditTrip }: TripSchedulingProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripPage, setTripPage] = useState(1);
  const [tripPagination, setTripPagination] = useState<PaginationMeta | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignVendorDialogOpen, setAssignVendorDialogOpen] = useState(false);
  const [jmpDialogOpen, setJmpDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [jccOpen, setJccOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedTripRequest, setSelectedTripRequest] = useState<StaffTripRequest | null>(null);
  const [loadingTripRequest, setLoadingTripRequest] = useState(false);

  // When a trip request row (TRQ-*) is opened in the details dialog, fetch the
  // underlying StaffTripRequest so trip-request workflow buttons (Forward,
  // Request changes, Reject) can render.
  useEffect(() => {
    if (!viewDialogOpen || !selectedTrip) {
      setSelectedTripRequest(null);
      setLoadingTripRequest(false);
      return;
    }
    const code = selectedTrip.tripNumber ?? "";
    if (!code.startsWith("TRQ-")) {
      setSelectedTripRequest(null);
      setLoadingTripRequest(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTripRequest(true);
      const res = await tripRequestApi.getById(String(selectedTrip.id));
      if (!cancelled && res.success && res.data?.trip) {
        setSelectedTripRequest(res.data.trip);
      }
      setLoadingTripRequest(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewDialogOpen, selectedTrip]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  // 8a — external driver toggle + fields (shared by create + edit dialogs)
  const [useExternalDriver, setUseExternalDriver] = useState(false);
  const [externalDriver, setExternalDriver] = useState<{
    name: string;
    phone: string;
    license_number: string;
  }>({ name: "", phone: "", license_number: "" });
  // 8e — dedicated edit passengers dialog
  const [editPassengersOpen, setEditPassengersOpen] = useState(false);
  const [passengerEditList, setPassengerEditList] = useState<string[]>([]);
  const [savingPassengers, setSavingPassengers] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState<Partial<CreateTripData>>({
    type: "personnel",
    priority: "normal",
    passengers: [],
  });
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [driverUserId, setDriverUserId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkTripUploadResult | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  
  const [vendorList, setVendorList] = useState<VendorItem[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Safe date formatter — returns fallback string for null/invalid dates
  const formatDate = (dateStr: string | undefined | null, opts?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return "Not set";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Not set";
    return opts ? d.toLocaleString(undefined, opts) : d.toLocaleString();
  };

  // Normalize backend snake_case response to camelCase Trip interface
  const normalizeTrip = (raw: any): Trip => ({
    id: (() => {
      const candidates = [raw.id, raw.trip_id, raw.uuid];
      for (const c of candidates) {
        if (c != null && c !== '') return String(c);
      }
      return String(raw.trip_code || raw.trip_number || raw.tripCode || '');
    })(),
    tripNumber: raw.trip_code || raw.tripNumber || raw.trip_number || `TRIP-${raw.id}`,
    type: raw.trip_type || raw.type || "personnel",
    status: raw.status || "draft",
    origin: raw.origin,
    destination: raw.destination,
    route: raw.route,
    distance: raw.distance,
    estimatedDuration: raw.estimated_duration || raw.estimatedDuration,
    scheduledDepartureAt: raw.scheduled_departure_at || raw.scheduledDepartureAt || "",
    scheduledArrivalAt: raw.scheduled_arrival_at || raw.scheduledArrivalAt,
    actualDepartureAt: raw.actual_departure_at || raw.actualDepartureAt,
    actualArrivalAt: raw.actual_arrival_at || raw.actualArrivalAt,
    vendorId: raw.vendor_id?.toString() || raw.vendorId,
    vendorName: raw.vendor?.name || raw.vendorName,
    vendorType: raw.vendor?.type || raw.vendorType,
    vehicleId: raw.vehicle_id?.toString() || raw.vehicleId,
    vehiclePlate: raw.vehicle?.plate || raw.vehiclePlate,
    vehicleType: raw.vehicle?.type || raw.vehicleType,
    driverName: raw.driver?.name || raw.driverName,
    driverPhone: raw.driver?.phone || raw.driverPhone,
    purpose: raw.purpose,
    priority: raw.priority || "normal",
    notes: raw.notes,
    cargo: raw.cargo,
    passengers: (raw.passengers || []).map((p: any) => ({
      id: p.id?.toString(),
      staffId: p.staff_id?.toString() || p.staffId,
      name: p.name,
      email: p.email,
      department: p.department,
      pickupLocation: p.pickup_location || p.pickupLocation,
      dropoffLocation: p.dropoff_location || p.dropoffLocation,
      notifiedAt: p.notified_at || p.notifiedAt,
    })),
    materials: raw.materials || [],
    scheduledBy: raw.created_by?.toString() || raw.scheduledBy || "",
    scheduledByName: raw.scheduledByName,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
    workflow_stage: raw.workflow_stage || raw.workflowStage,
    workflowStage: raw.workflow_stage || raw.workflowStage,
    selected_vendor_id: raw.selected_vendor_id ?? raw.selectedVendorId,
    selectedVendorId: raw.selected_vendor_id ?? raw.selectedVendorId,
    unsigned_po_url: raw.unsigned_po_url || raw.unsignedPoUrl,
    unsignedPoUrl: raw.unsigned_po_url || raw.unsignedPoUrl,
    signed_po_url: raw.signed_po_url || raw.signedPoUrl,
    signedPoUrl: raw.signed_po_url || raw.signedPoUrl,
  });

  // Fetch trips from API (server-side pagination)
  const fetchTrips = async () => {
    setLoading(true);
    try {
      // Global Trip Directory — merge scheduled trips with staff trip requests
      // that have not yet been converted, so all lifecycle states are visible.
      const [tripsRes, requestsRes] = await Promise.all([
        tripsApi.list({
          page: tripPage,
          per_page: 25,
          status: statusFilter !== "all" ? statusFilter : undefined,
          type: typeFilter !== "all" ? typeFilter : undefined,
          search: debouncedSearch.trim() || undefined,
        }),
        // Only merge on first page when no filters — avoids duplicate/inconsistent paging.
        tripPage === 1 && statusFilter === "all" && typeFilter === "all"
          ? tripRequestApi.listAll({ per_page: 25 }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const scheduled = tripsRes.success && tripsRes.data
        ? tripsRes.data.items.map(normalizeTrip)
        : [];
      const scheduledIds = new Set(
        scheduled
          .map((t) => String(t.id))
          .concat(scheduled.map((t) => t.tripNumber ?? "")),
      );

      const requestOnly: Trip[] = [];
      if (requestsRes && requestsRes.success && requestsRes.data?.trips) {
        for (const r of requestsRes.data.trips) {
          const linkedTripId =
            r.logisticsTripId ?? r.logistics_trip_id ?? r.tripId ?? r.trip_id;
          const code = r.tripCode ?? r.trip_code ?? "";
          if (linkedTripId && scheduledIds.has(String(linkedTripId))) continue;
          if (code && scheduledIds.has(code)) continue;
          requestOnly.push(
            normalizeTrip({
              id: r.id,
              trip_code: code || `TRQ-${r.id}`,
              trip_type: "personnel",
              status: r.status || "pending_approval",
              origin: r.origin,
              destination: r.destination,
              scheduled_departure_at: r.scheduledDepartureAt ?? r.scheduled_departure_at,
              scheduled_arrival_at: r.scheduledArrivalAt ?? r.scheduled_arrival_at,
              purpose: r.purpose,
              priority: "normal",
              workflow_stage: r.workflowStage ?? r.workflow_stage,
              created_at: r.createdAt ?? r.created_at,
              passengers: r.passengers ?? [],
            }),
          );
        }
      }

      if (tripsRes.success && tripsRes.data) {
        setTrips([...scheduled, ...requestOnly]);
        const pag = tripsRes.data.pagination;
        setTripPagination(
          pag
            ? { ...pag, total: (pag.total ?? scheduled.length) + requestOnly.length }
            : null,
        );
      } else {
        setTrips(requestOnly);
        setTripPagination(null);
      }
    } catch (error) {
      console.error("Failed to fetch trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendors from API
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const response = await logisticsVendorsApi.getAll();
      if (response.success && response.data) {
        const vendors: VendorItem[] = response.data.map((v: any) => ({
          id: v.id?.toString() || v.vendor_id,
          name: v.name || v.company_name,
          contact: v.contact || v.phone,
          vehicles: v.vehicles || v.vehicle_count,
        }));
        setVendorList(vendors);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setLoadingVendors(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    setTripPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchTrips();
  }, [statusFilter, typeFilter, tripPage, debouncedSearch]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const tripsHasActiveFilters =
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    Boolean(debouncedSearch.trim());

  const fetchTripExportPage = useCallback(
    async (page: number, perPage: number) => {
      const response = await tripsApi.list({
        page,
        per_page: perPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      if (!response.success || !response.data) {
        return { items: [] as TripExportRow[] };
      }
      const items: TripExportRow[] = response.data.items.map((raw: any) => {
        const t = normalizeTrip(raw);
        return {
          id: t.id,
          tripCode: (t as any).tripCode || t.id,
          type: t.type,
          status: t.status,
          origin: t.origin,
          destination: t.destination,
          departureDate: (t as any).scheduledDepartureAt || (t as any).departureDate,
          workflowStage: t.workflowStage || t.workflow_stage,
        };
      });
      return { items, pagination: response.data.pagination };
    },
    [debouncedSearch, statusFilter, typeFilter],
  );

  const tripTableExport = useTableExport({
    filenamePrefix: "Trips",
    columns: TRIP_EXPORT_COLUMNS,
    fetchPage: fetchTripExportPage,
    hasActiveFilters: tripsHasActiveFilters,
  });

  const handleCreateTrip = async () => {
    if (!formData.origin || !formData.destination || !formData.scheduledDepartureAt) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }
    if (
      useExternalDriver &&
      (!externalDriver.name.trim() || !externalDriver.phone.trim())
    ) {
      toast({
        title: "External driver details required",
        description: "Enter the external driver's name and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build passengers list
      const passengers: Omit<TripPassenger, "id" | "notifiedAt">[] = selectedPassengers.map((staffId) => ({
        staffId,
        name: "",
        email: "",
        department: "",
      }));

      // Build payload in snake_case as expected by Laravel backend
      const tripPayload = {
        trip_type: formData.type || "personnel",
        origin: formData.origin,
        destination: formData.destination,
        route: formData.route || null,
        scheduled_departure_at: formData.scheduledDepartureAt
          ? new Date(formData.scheduledDepartureAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        scheduled_arrival_at: formData.scheduledArrivalAt
          ? new Date(formData.scheduledArrivalAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        purpose: formData.purpose || null,
        priority: formData.priority || "normal",
        notes: formData.notes || null,
        cargo: formData.cargo || null,
        passengers: passengers.map(p => ({
          staff_id: p.staffId,
          name: p.name,
          email: p.email,
          department: p.department,
        })),
        passenger_user_ids: selectedPassengers
          .map((id) => parseInt(id, 10))
          .filter((n) => !Number.isNaN(n)),
        driver_user_id:
          useExternalDriver || !driverUserId ? undefined : parseInt(driverUserId, 10),
        external_driver: useExternalDriver
          ? {
              name: externalDriver.name.trim(),
              phone: externalDriver.phone.trim(),
              license_number: externalDriver.license_number.trim() || undefined,
            }
          : undefined,
      };

      const response = await tripsApi.create(tripPayload as any);
      
      if (response.success) {
        toast({
          title: "Trip Scheduled",
          description: `Trip from ${formData.origin} to ${formData.destination} has been scheduled.`,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchTrips();
      } else {
        toast({
          title: "Failed to Schedule Trip",
          description: response.error || "Unable to create trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create trip. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await tripsApi.bulkUpload(uploadFile);
      if (response.success && response.data) {
        setUploadResult(response.data);
        if (response.data.successfulRows > 0) {
          toast({
            title: "Upload Successful",
            description: `${response.data.successfulRows} of ${response.data.totalRows} trips created.`,
          });
          fetchTrips();
        }
      } else {
        toast({
          title: "Upload Failed",
          description: response.error || "Failed to process file",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = async (templateType: 'personnel-trip' | 'journey-management' = 'personnel-trip') => {
    try {
      const blob = await logisticsDashboardApi.downloadTemplate(templateType);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = templateType === 'journey-management' 
          ? "journey_management_template.xlsx" 
          : "personnel_trip_template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Template Downloaded",
          description: `${templateType === 'journey-management' ? 'Journey Management' : 'Personnel Trip'} template downloaded successfully`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: "Template file not available",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download template",
        variant: "destructive",
      });
    }
  };

  const handleCancelTrip = async (trip: Trip) => {
    try {
      const response = await tripsApi.cancel(trip.id, "Cancelled by user");
      if (response.success) {
        toast({
          title: "Trip Cancelled",
          description: `Trip ${trip.tripNumber} has been cancelled.`,
        });
        fetchTrips();
      } else {
        toast({
          title: "Failed to Cancel Trip",
          description: response.error || "Unable to cancel trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel trip. Please check your connection.",
        variant: "destructive",
      });
    }
  };


  const handleEditTrip = async () => {
    if (!selectedTrip || !formData.origin || !formData.destination) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }
    if (
      useExternalDriver &&
      (!externalDriver.name.trim() || !externalDriver.phone.trim())
    ) {
      toast({
        title: "External driver details required",
        description: "Enter the external driver's name and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build passengers list from selected
      const passengers: Omit<TripPassenger, "id" | "notifiedAt">[] = selectedPassengers.map((staffId) => ({
        staffId,
        name: "",
        email: "",
        department: "",
      }));

      const editPayload = {
        trip_type: formData.type,
        origin: formData.origin,
        destination: formData.destination,
        route: formData.route || null,
        scheduled_departure_at: formData.scheduledDepartureAt
          ? new Date(formData.scheduledDepartureAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        scheduled_arrival_at: formData.scheduledArrivalAt
          ? new Date(formData.scheduledArrivalAt).toISOString().replace('T', ' ').substring(0, 19)
          : null,
        purpose: formData.purpose || null,
        priority: formData.priority,
        notes: formData.notes || null,
        cargo: formData.cargo || null,
        passenger_user_ids: selectedPassengers
          .map((id) => parseInt(id, 10))
          .filter((n) => !Number.isNaN(n)),
        driver_user_id:
          useExternalDriver || !driverUserId ? undefined : parseInt(driverUserId, 10),
        external_driver: useExternalDriver
          ? {
              name: externalDriver.name.trim(),
              phone: externalDriver.phone.trim(),
              license_number: externalDriver.license_number.trim() || undefined,
            }
          : undefined,
      };

      const response = await tripsApi.update(selectedTrip.id, editPayload as any);

      if (response.success) {
        toast({
          title: "Trip Updated",
          description: `Trip ${selectedTrip.tripNumber} has been updated.`,
        });
        setEditDialogOpen(false);
        fetchTrips();
      } else {
        toast({
          title: "Failed to Update Trip",
          description: response.error || "Unable to update trip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update trip. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedTrip || !selectedVendorId) {
      toast({
        title: "Validation Error",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    const tripId = String(selectedTrip.id ?? "").trim();
    if (!tripId) {
      toast({
        title: "Cannot assign vendor",
        description:
          "This trip has no server id. Refresh the trip list and try again, or contact support if the problem persists.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const vendor = vendorList.find(v => v.id === selectedVendorId);
      const response = await tripsApi.assignVendor(tripId, selectedVendorId);

      if (response.success) {
        toast({
          title: "Vendor Assigned",
          description: `${vendor?.name} has been assigned to ${selectedTrip.tripNumber}.`,
        });
        setAssignVendorDialogOpen(false);
        setSelectedVendorId("");
        fetchTrips();
      } else {
        toast({
          title: "Failed to Assign Vendor",
          description: response.error || "Unable to assign vendor. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign vendor. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (trip: Trip) => {
    setSelectedTrip(trip);
    setFormData({
      type: trip.type,
      origin: trip.origin,
      destination: trip.destination,
      route: trip.route,
      scheduledDepartureAt: trip.scheduledDepartureAt,
      scheduledArrivalAt: trip.scheduledArrivalAt,
      purpose: trip.purpose,
      priority: trip.priority,
      notes: trip.notes,
      cargo: trip.cargo,
    });
    setSelectedPassengers(trip.passengers?.map(p => p.staffId) || []);
    // Detect external driver: trip carries driver name/phone but no internal driver id
    const tAny = trip as any;
    const extName = tAny.external_driver?.name || (!tAny.driver_id && trip.driverName) || "";
    const extPhone = tAny.external_driver?.phone || (!tAny.driver_id && trip.driverPhone) || "";
    const extLicense = tAny.external_driver?.license_number || tAny.external_driver?.licenseNumber || "";
    if (extName || extPhone) {
      setUseExternalDriver(true);
      setExternalDriver({
        name: extName,
        phone: extPhone,
        license_number: extLicense,
      });
      setDriverUserId(undefined);
    } else {
      setUseExternalDriver(false);
      setExternalDriver({ name: "", phone: "", license_number: "" });
    }
    setEditDialogOpen(true);
  };

  const openAssignVendorDialog = (trip: Trip) => {
    setSelectedTrip(trip);
    setSelectedVendorId(trip.vendorId || "");
    setAssignVendorDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      type: "personnel",
      priority: "normal",
      passengers: [],
    });
    setSelectedPassengers([]);
    setDriverUserId(undefined);
    setUseExternalDriver(false);
    setExternalDriver({ name: "", phone: "", license_number: "" });
  };

  const filteredTrips = trips;

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trip Scheduling</h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and track scheduled trips
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TripRequestDialog userRole={getScmRole(user)} onCreated={fetchTrips} />
          <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            CSV Import
          </Button>
          <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Excel Upload
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Trip</DialogTitle>
                <DialogDescription>
                  Create a new trip for personnel or material movement
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Trip Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trip Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: TripType) =>
                        setFormData(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personnel">Personnel Movement</SelectItem>
                        <SelectItem value="material">Material Movement</SelectItem>
                        <SelectItem value="mixed">Mixed (Personnel + Material)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData(prev => ({ ...prev, priority: value as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Origin & Destination */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Origin *</Label>
                    <Input
                      placeholder="e.g., Lagos Head Office"
                      value={formData.origin || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, origin: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination *</Label>
                    <Input
                      placeholder="e.g., Abuja Branch"
                      value={formData.destination || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, destination: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Route Description */}
                <div className="space-y-2">
                  <Label>Route Description</Label>
                  <Input
                    placeholder="e.g., Via Lokoja-Abuja Highway"
                    value={formData.route || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, route: e.target.value }))
                    }
                  />
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scheduled Departure *</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledDepartureAt || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, scheduledDepartureAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Arrival</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledArrivalAt || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, scheduledArrivalAt: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Purpose */}
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input
                    placeholder="e.g., Board Meeting, Equipment Delivery"
                    value={formData.purpose || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, purpose: e.target.value }))
                    }
                  />
                </div>

                {/* Cargo (for material trips) */}
                {(formData.type === "material" || formData.type === "mixed") && (
                  <div className="space-y-2">
                    <Label>Cargo Description</Label>
                    <Textarea
                      placeholder="Describe the materials being transported"
                      value={formData.cargo || ""}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, cargo: e.target.value }))
                      }
                    />
                  </div>
                )}

                {(formData.type === "personnel" || formData.type === "mixed") && (
                  <>
                    <EligiblePassengerPicker
                      selectedPassengerIds={selectedPassengers}
                      onPassengersChange={setSelectedPassengers}
                      driverUserId={useExternalDriver ? undefined : driverUserId}
                      onDriverChange={useExternalDriver ? undefined : setDriverUserId}
                      showDriver={!useExternalDriver}
                    />
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Use external driver</Label>
                          <p className="text-xs text-muted-foreground">
                            Driver is not on staff (e.g. vendor / contracted).
                          </p>
                        </div>
                        <Switch
                          checked={useExternalDriver}
                          onCheckedChange={(v) => {
                            setUseExternalDriver(v);
                            if (v) setDriverUserId(undefined);
                          }}
                        />
                      </div>
                      {useExternalDriver && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name *</Label>
                            <Input
                              value={externalDriver.name}
                              onChange={(e) =>
                                setExternalDriver((d) => ({ ...d, name: e.target.value }))
                              }
                              placeholder="Full name"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Phone *</Label>
                            <Input
                              value={externalDriver.phone}
                              onChange={(e) =>
                                setExternalDriver((d) => ({ ...d, phone: e.target.value }))
                              }
                              placeholder="e.g. 0803…"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">License #</Label>
                            <Input
                              value={externalDriver.license_number}
                              onChange={(e) =>
                                setExternalDriver((d) => ({
                                  ...d,
                                  license_number: e.target.value,
                                }))
                              }
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional instructions or notes"
                    value={formData.notes || ""}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTrip} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Schedule Trip"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trips..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="vendor_assigned">Vendor Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchTrips}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <TableExportMenu export={tripTableExport} title="Export trips" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Trips</CardTitle>
          <CardDescription>
            {filteredTrips.length} trip(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trips found</p>
              <p className="text-sm">Create a new trip to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Vendor/Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell className="font-mono text-sm">
                        {trip.tripNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {trip.type === "personnel" && <Users className="mr-1 h-3 w-3" />}
                          {trip.type === "material" && <Package className="mr-1 h-3 w-3" />}
                          {trip.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {trip.origin} → {trip.destination}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(trip.scheduledDepartureAt, { dateStyle: "medium" } as any)}
                          {trip.scheduledDepartureAt && !isNaN(new Date(trip.scheduledDepartureAt).getTime()) && (
                            <>
                              <Clock className="h-3 w-3 ml-1 text-muted-foreground" />
                              {new Date(trip.scheduledDepartureAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {trip.vendorName || trip.driverName || (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(statusColors[trip.status], "capitalize")}>
                          {trip.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(priorityColors[trip.priority], "capitalize")}>
                          {trip.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedTrip(trip);
                              setViewDialogOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {(() => {
                              const stage =
                                (trip as Trip & { workflow_stage?: string }).workflow_stage ||
                                (trip as Trip & { workflowStage?: string }).workflowStage;
                              const isLogistics =
                                getScmRole(user) &&
                                ["logistics_manager", "logistics_officer", "logistics", "admin"].includes(
                                  getScmRole(user),
                                );
                              const isProcurement =
                                getScmRole(user) &&
                                ["procurement", "procurement_manager"].includes(getScmRole(user));
                              const isScd =
                                getScmRole(user) &&
                                ["supply_chain_director", "supply_chain"].includes(getScmRole(user));
                              if (
                                isLogistics &&
                                (stage === "trip_request" || stage === "logistics_review" || !stage)
                              ) {
                                return (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTrip(trip);
                                      setViewDialogOpen(true);
                                    }}
                                  >
                                    <Truck className="mr-2 h-4 w-4" />
                                    Review trip request
                                  </DropdownMenuItem>
                                );
                              }
                              if (
                                isProcurement &&
                                (stage === "vendor_selection" || stage === "procurement_review")
                              ) {
                                return (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedTrip(trip);
                                        setComparisonOpen(true);
                                      }}
                                    >
                                      <Users2 className="mr-2 h-4 w-4" />
                                      Compare vendor quotes
                                    </DropdownMenuItem>
                                    {stage === "procurement_review" && trip.vendorId && (
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          const res = await tripRequestApi.procurementApproveQuote(
                                            String(trip.id),
                                          );
                                          if (res.success) {
                                            toast({ title: "Quote approved" });
                                            fetchTrips();
                                          } else {
                                            toast({
                                              title: "Failed",
                                              description: res.error,
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                      >
                                        <FileCheck className="mr-2 h-4 w-4" />
                                        Approve vendor quote
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                );
                              }
                              if (isScd && stage === "scd_approval") {
                                return (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      const res = await tripRequestApi.scdApprove(String(trip.id));
                                      if (res.success) {
                                        toast({ title: "SCD approval recorded" });
                                        fetchTrips();
                                      } else {
                                        toast({
                                          title: "Failed",
                                          description: res.error,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    <FileCheck className="mr-2 h-4 w-4" />
                                    SCD approve
                                  </DropdownMenuItem>
                                );
                              }
                              return null;
                            })()}
                            {trip.status !== "completed" && trip.status !== "cancelled" && (
                              <>
                                <DropdownMenuItem onClick={() => openEditDialog(trip)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Trip
                                </DropdownMenuItem>
                                {(trip.type === "personnel" || trip.type === "mixed") && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTrip(trip);
                                      setPassengerEditList(
                                        (trip.passengers || [])
                                          .map((p) => p.staffId)
                                          .filter(Boolean) as string[],
                                      );
                                      setEditPassengersOpen(true);
                                    }}
                                  >
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Edit Passengers
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    window.dispatchEvent(
                                      new CustomEvent("logistics:set-tab", {
                                        detail: "accommodation",
                                      }),
                                    );
                                    window.dispatchEvent(
                                      new CustomEvent("accommodation:prefill", {
                                        detail: {
                                          tripId: String(trip.id),
                                          tripNumber: trip.tripNumber,
                                          passengerNames: (trip.passengers || [])
                                            .map((p) => p.name)
                                            .filter(Boolean),
                                          destinationCity: trip.destination ?? "",
                                          destinationState: "",
                                          checkInDate: trip.scheduledDepartureAt
                                            ? trip.scheduledDepartureAt.slice(0, 10)
                                            : "",
                                        },
                                      }),
                                    );
                                  }}
                                >
                                  <Hotel className="mr-2 h-4 w-4" />
                                  Book Accommodation
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAssignVendorDialog(trip)}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Assign Vendor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedTrip(trip); setComparisonOpen(true); }}>
                                  <Users2 className="mr-2 h-4 w-4" />
                                  Compare Vendor Responses
                                </DropdownMenuItem>
                                {trip.vendorId && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedTrip(trip);
                                    setJmpDialogOpen(true);
                                  }}>
                                    <FileCheck className="mr-2 h-4 w-4" />
                                    Submit JMP
                                  </DropdownMenuItem>
                                )}
                                {trip.passengers && trip.passengers.length > 0 && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedTrip(trip);
                                    setNotificationDialogOpen(true);
                                  }}>
                                    <Bell className="mr-2 h-4 w-4" />
                                    Notify Passengers
                                  </DropdownMenuItem>
                                )}
                                {trip.status === "in_progress" && (
                                  <DropdownMenuItem onClick={() => { setSelectedTrip(trip); setJccOpen(true); }}>
                                    <FileSignature className="mr-2 h-4 w-4" />
                                    Close Trip / Issue JCC
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleCancelTrip(trip)}
                                  className="text-destructive"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Trip
                                </DropdownMenuItem>
                              </>
                            )}
                            {trip.status === "completed" && (
                              <DropdownMenuItem onClick={() => { setSelectedTrip(trip); setJccOpen(true); }}>
                                <FileSignature className="mr-2 h-4 w-4" />
                                Close Trip / Issue JCC
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ServerPaginationBar
                pagination={tripPagination}
                page={tripPage}
                onPageChange={setTripPage}
                className="mt-4"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle>Bulk Upload Trips</DialogTitle>
            <DialogDescription className="text-sm">
              Upload an Excel file with trip data using the provided template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Template Download Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full h-auto py-3 px-4 justify-start gap-3" 
                onClick={() => handleDownloadTemplate('personnel-trip')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="text-sm text-left truncate">Personnel Trip Template</span>
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-auto py-3 px-4 justify-start gap-3" 
                onClick={() => handleDownloadTemplate('journey-management')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="text-sm text-left truncate">Journey Management Template</span>
              </Button>
            </div>
            
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="bulk-upload-input"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="bulk-upload-input" className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadFile ? (
                    <span className="text-foreground font-medium">{uploadFile.name}</span>
                  ) : (
                    "Click to select file or drag and drop"
                  )}
                </p>
              </label>
            </div>
            
            {/* Upload Result */}
            {uploadResult && (
              <div className={cn(
                "p-4 rounded-lg",
                uploadResult.failedRows > 0 ? "bg-warning/10" : "bg-success/10"
              )}>
                <p className="font-medium text-sm">
                  Upload Result: {uploadResult.successfulRows}/{uploadResult.totalRows} successful
                </p>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-destructive">Errors:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {uploadResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="text-muted-foreground">
                          Row {error.row}: {error.field} - {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload} disabled={!uploadFile || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Trip Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trip Details - {selectedTrip?.tripNumber}</DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm items-center">
                <Badge className={cn(statusColors[selectedTrip.status], "capitalize")}>
                  {selectedTrip.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {selectedTrip.type}
                </Badge>
                <Badge variant="outline" className={cn(priorityColors[selectedTrip.priority], "capitalize")}>
                  {selectedTrip.priority}
                </Badge>
              </div>
              
              {/* Main Trip Information */}
              <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium uppercase">Origin</Label>
                    <p className="text-sm font-medium mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {selectedTrip.origin}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium uppercase">Destination</Label>
                    <p className="text-sm font-medium mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {selectedTrip.destination}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium uppercase">Scheduled Departure</Label>
                    <p className="text-sm font-medium mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDateTime(selectedTrip.scheduledDepartureAt)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium uppercase">Scheduled Arrival</Label>
                    <p className="text-sm font-medium mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDateTime(selectedTrip.scheduledArrivalAt)}
                    </p>
                  </div>
                  {selectedTrip.vendorName && (
                    <div>
                      <Label className="text-xs text-muted-foreground font-medium uppercase">Vendor</Label>
                      <p className="text-sm font-medium mt-0.5">{selectedTrip.vendorName}</p>
                    </div>
                  )}
                  {selectedTrip.driverName && (
                    <div>
                      <Label className="text-xs text-muted-foreground font-medium uppercase">Driver</Label>
                      <p className="text-sm font-medium mt-0.5">{selectedTrip.driverName}</p>
                    </div>
                  )}
                </div>

                {/* Passengers Section - Always show for visibility */}
                <Separator />
                <div>
                  {(() => {
                    // Get passengers from StaffTripRequest if available, otherwise from Trip
                    const internalPassengers = selectedTripRequest?.passengers ?? selectedTrip.passengers ?? [];
                    const externalPassengers = selectedTripRequest?.externalPassengers ?? selectedTripRequest?.external_passengers ?? [];
                    const totalPassengers = internalPassengers.length + externalPassengers.length;
                    
                    return (
                      <>
                        <Label className="text-xs text-muted-foreground font-medium uppercase mb-1.5 block">
                          Passengers ({totalPassengers})
                        </Label>
                        {totalPassengers > 0 ? (
                          <div className="mt-2 space-y-2">
                            {internalPassengers.map((passenger, idx) => (
                              <div key={passenger.id ?? `p-${idx}`} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                                <Users className="h-4 w-4" />
                                <span>{passenger.name}</span>
                                {passenger.department && <span className="text-muted-foreground">({passenger.department})</span>}
                              </div>
                            ))}
                            {externalPassengers.map((passenger, idx) => (
                              <div key={`ext-${idx}`} className="flex items-center gap-2 text-sm p-2 bg-muted rounded border border-border/40">
                                <Users className="h-4 w-4" />
                                <span>{passenger.name}</span>
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">External</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-1">No passengers assigned yet</p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Staff Trip Request Information - Loading or Loaded */}
                {(selectedTripRequest || loadingTripRequest) && (
                  <>
                    <Separator />
                    {loadingTripRequest ? (
                      <div className="space-y-3">
                        <div className="h-8 bg-muted rounded animate-pulse" />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-6 bg-muted rounded animate-pulse" />
                          <div className="h-6 bg-muted rounded animate-pulse" />
                        </div>
                        <div className="h-6 bg-muted rounded animate-pulse col-span-2" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="h-20 bg-muted rounded animate-pulse" />
                          <div className="h-20 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedTripRequest?.requesterName && (
                            <div>
                              <Label className="text-xs text-muted-foreground font-medium uppercase">Requester</Label>
                              <p className="text-sm font-medium mt-0.5">{selectedTripRequest.requesterName}</p>
                            </div>
                          )}
                          {selectedTripRequest?.requesterDepartment && (
                            <div>
                              <Label className="text-xs text-muted-foreground font-medium uppercase">Department</Label>
                              <p className="text-sm font-medium mt-0.5">{selectedTripRequest.requesterDepartment}</p>
                            </div>
                          )}
                          {selectedTripRequest?.purpose && (
                            <div className="col-span-2">
                              <Label className="text-xs text-muted-foreground font-medium uppercase">Purpose</Label>
                              <p className="text-sm mt-0.5">{selectedTripRequest.purpose}</p>
                            </div>
                          )}
                        </div>

                        {/* Accommodation & Escort Section */}
                        {(selectedTripRequest?.accommodationRequired || selectedTripRequest?.escortRequired) && (
                          <>
                            <Separator />
                            <div className="grid gap-3 sm:grid-cols-2">
                              {selectedTripRequest?.accommodationRequired && (
                                <div className="rounded-md border border-border/40 bg-background/60 p-3 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-sm font-medium">
                                    <BedDouble className="h-4 w-4 text-primary" />
                                    Accommodation Requested
                                  </div>
                                  {selectedTripRequest.accommodationName ||
                                  selectedTripRequest.accommodationAddress ||
                                  selectedTripRequest.accommodationContact ||
                                  selectedTripRequest.accommodationDetails ||
                                  selectedTripRequest.accommodationEstimatedCost ? (
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      {selectedTripRequest.accommodationName && (
                                        <div>
                                          <span className="font-medium text-foreground">Hotel:</span> {selectedTripRequest.accommodationName}
                                        </div>
                                      )}
                                      {selectedTripRequest.accommodationAddress && (
                                        <div>
                                          <span className="font-medium text-foreground">Address:</span> {selectedTripRequest.accommodationAddress}
                                        </div>
                                      )}
                                      {selectedTripRequest.accommodationContact && (
                                        <div>
                                          <span className="font-medium text-foreground">Contact:</span> {selectedTripRequest.accommodationContact}
                                        </div>
                                      )}
                                      {selectedTripRequest.accommodationDetails && (
                                        <div>
                                          <span className="font-medium text-foreground">Notes:</span> {selectedTripRequest.accommodationDetails}
                                        </div>
                                      )}
                                      {selectedTripRequest.accommodationEstimatedCost != null && (
                                        <div>
                                          <span className="font-medium text-foreground">Est. Cost:</span>{" "}
                                          {formatPoAmount(Number(selectedTripRequest.accommodationEstimatedCost), "NGN")}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      Requester did not specify a hotel. Logistics will arrange accommodation.
                                    </p>
                                  )}
                                </div>
                              )}
                              {selectedTripRequest?.escortRequired && (
                                <div className="rounded-md border border-border/40 bg-background/60 p-3 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-sm font-medium">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Escort Requested
                                  </div>
                                  {selectedTripRequest.escortDescription ? (
                                    <p className="text-xs text-muted-foreground">{selectedTripRequest.escortDescription}</p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      Requester did not specify escort details. Logistics will assign one.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Notes Section */}
                {selectedTrip.notes && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground font-medium uppercase">Notes</Label>
                      <p className="text-sm mt-0.5">{selectedTrip.notes}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Trip Workflow Actions */}
              <TripWorkflowActions
                trip={selectedTrip}
                userRole={getScmRole(user)}
                onUpdated={fetchTrips}
                onAssignVendor={() => {
                  openAssignVendorDialog(selectedTrip);
                  setViewDialogOpen(false);
                }}
                onCompareVendors={() => {
                  setComparisonOpen(true);
                  setViewDialogOpen(false);
                }}
              />
              
              {/* Trip Request Workflow Actions */}
              {selectedTripRequest && (selectedTripRequest.availableActions?.length ?? 0) > 0 && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-3">Trip Request Actions</p>
                  <TripRequestWorkflowActions
                    trip={selectedTripRequest}
                    onUpdated={() => {
                      fetchTrips();
                      void tripRequestApi.getById(String(selectedTrip.id)).then((r) => {
                        if (r.success && r.data?.trip) setSelectedTripRequest(r.data.trip);
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Trip Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Trip - {selectedTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Update trip details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Trip Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trip Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TripType) =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personnel">Personnel Movement</SelectItem>
                    <SelectItem value="material">Material Movement</SelectItem>
                    <SelectItem value="mixed">Mixed (Personnel + Material)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, priority: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Origin & Destination */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origin *</Label>
                <Input
                  placeholder="e.g., Lagos Head Office"
                  value={formData.origin || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, origin: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Destination *</Label>
                <Input
                  placeholder="e.g., Abuja Branch"
                  value={formData.destination || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, destination: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Route Description */}
            <div className="space-y-2">
              <Label>Route Description</Label>
              <Input
                placeholder="e.g., Via Lokoja-Abuja Highway"
                value={formData.route || ""}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, route: e.target.value }))
                }
              />
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled Departure *</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledDepartureAt?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, scheduledDepartureAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Arrival</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledArrivalAt?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, scheduledArrivalAt: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input
                placeholder="e.g., Board Meeting, Equipment Delivery"
                value={formData.purpose || ""}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, purpose: e.target.value }))
                }
              />
            </div>

            {/* Cargo (for material trips) */}
            {(formData.type === "material" || formData.type === "mixed") && (
              <div className="space-y-2">
                <Label>Cargo Description</Label>
                <Textarea
                  placeholder="Describe the materials being transported"
                  value={formData.cargo || ""}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, cargo: e.target.value }))
                  }
                />
              </div>
            )}

            {(formData.type === "personnel" || formData.type === "mixed") && (
              <>
                <EligiblePassengerPicker
                  selectedPassengerIds={selectedPassengers}
                  onPassengersChange={setSelectedPassengers}
                  driverUserId={useExternalDriver ? undefined : driverUserId}
                  onDriverChange={useExternalDriver ? undefined : setDriverUserId}
                  showDriver={!useExternalDriver}
                />
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Use external driver</Label>
                      <p className="text-xs text-muted-foreground">
                        Driver is not on staff (e.g. vendor / contracted).
                      </p>
                    </div>
                    <Switch
                      checked={useExternalDriver}
                      onCheckedChange={(v) => {
                        setUseExternalDriver(v);
                        if (v) setDriverUserId(undefined);
                      }}
                    />
                  </div>
                  {useExternalDriver && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={externalDriver.name}
                          onChange={(e) =>
                            setExternalDriver((d) => ({ ...d, name: e.target.value }))
                          }
                          placeholder="Full name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone *</Label>
                        <Input
                          value={externalDriver.phone}
                          onChange={(e) =>
                            setExternalDriver((d) => ({ ...d, phone: e.target.value }))
                          }
                          placeholder="e.g. 0803…"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">License #</Label>
                        <Input
                          value={externalDriver.license_number}
                          onChange={(e) =>
                            setExternalDriver((d) => ({
                              ...d,
                              license_number: e.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional instructions or notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTrip} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Passengers Dialog (Batch 2 Item 8e) */}
      <Dialog
        open={editPassengersOpen}
        onOpenChange={(o) => {
          setEditPassengersOpen(o);
          if (!o) setPassengerEditList([]);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Passengers — {selectedTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Add or remove passengers without changing the rest of the trip.
              Notifications fire automatically when the list changes.
            </DialogDescription>
          </DialogHeader>
          <EligiblePassengerPicker
            selectedPassengerIds={passengerEditList}
            onPassengersChange={setPassengerEditList}
            showDriver={false}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditPassengersOpen(false)}
              disabled={savingPassengers}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTrip) return;
                setSavingPassengers(true);
                try {
                  const res = await tripsApi.update(selectedTrip.id, {
                    passenger_user_ids: passengerEditList
                      .map((id) => parseInt(id, 10))
                      .filter((n) => !Number.isNaN(n)),
                  } as any);
                  if (res.success) {
                    toast({
                      title: "Passengers updated",
                      description: `${passengerEditList.length} passenger(s) on trip ${selectedTrip.tripNumber}.`,
                    });
                    setEditPassengersOpen(false);
                    setPassengerEditList([]);
                    fetchTrips();
                  } else {
                    toast({
                      title: "Failed to update passengers",
                      description: res.error || "Please try again.",
                      variant: "destructive",
                    });
                  }
                } catch {
                  toast({
                    title: "Error",
                    description: "Could not save passenger changes.",
                    variant: "destructive",
                  });
                } finally {
                  setSavingPassengers(false);
                }
              }}
              disabled={savingPassengers}
            >
              {savingPassengers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Passengers"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Vendor Dialog */}
      <Dialog open={assignVendorDialogOpen} onOpenChange={setAssignVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Vendor - {selectedTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Select a logistics vendor to handle this trip
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Vendor *</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendorList.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      <div className="flex flex-col">
                        <span>{vendor.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {vendor.vehicles} vehicles • {vendor.contact}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedVendorId && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium text-sm mb-2">Vendor Details</h4>
                {(() => {
                  const vendor = vendorList.find(v => v.id === selectedVendorId);
                  return vendor ? (
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {vendor.name}</p>
                      <p><span className="text-muted-foreground">Contact:</span> {vendor.contact}</p>
                      <p><span className="text-muted-foreground">Fleet Size:</span> {vendor.vehicles} vehicles</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setAssignVendorDialogOpen(false);
              setSelectedVendorId("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssignVendor} disabled={!selectedVendorId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Vendor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JMP Submission Dialog */}
      {selectedTrip && (
        <VendorJMPSubmission
          trip={selectedTrip}
          open={jmpDialogOpen}
          onOpenChange={setJmpDialogOpen}
          onSubmit={async (data) => {
            // Update trip with JMP data
            setTrips(prev => prev.map(t =>
              t.id === selectedTrip.id
                ? {
                    ...t,
                    vehiclePlate: data.vehiclePlate,
                    vehicleType: data.vehicleType,
                    driverName: data.driverName,
                    driverPhone: data.driverPhone,
                    status: "vendor_assigned" as TripStatus,
                  }
                : t
            ));
            toast({
              title: "JMP Submitted",
              description: "Passengers will be automatically notified",
            });
          }}
        />
      )}

      {/* Passenger Notification Dialog */}
      {selectedTrip && (
        <PassengerNotification
          trip={selectedTrip}
          open={notificationDialogOpen}
          onOpenChange={setNotificationDialogOpen}
          onSendNotifications={async () => {
            setTrips(prev => prev.map(t =>
              t.id === selectedTrip.id
                ? {
                    ...t,
                    passengers: t.passengers?.map(p => ({
                      ...p,
                      notifiedAt: new Date().toISOString(),
                    })),
                  }
                : t
            ));
          }}
        />
      )}

      {/* CSV Import with Preview */}
      <CSVImportPreview
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        title="Import Trips from CSV"
        description="Upload a CSV file with trip data. Preview and verify before importing."
        columns={[
          { key: "origin", label: "Origin", required: true },
          { key: "destination", label: "Destination", required: true },
          { key: "type", label: "Trip Type" },
          { key: "scheduled_departure", label: "Scheduled Departure", required: true },
          { key: "scheduled_arrival", label: "Scheduled Arrival" },
          { key: "purpose", label: "Purpose" },
          { key: "priority", label: "Priority" },
          { key: "route", label: "Route" },
          { key: "cargo", label: "Cargo" },
          { key: "notes", label: "Notes" },
        ] as CSVColumn[]}
        onConfirmImport={async (data) => {
          // Create trips one by one from parsed CSV data
          let successCount = 0;
          let failCount = 0;
          for (const row of data) {
            try {
              const depAt = row.scheduled_departure
                ? new Date(row.scheduled_departure).toISOString().replace('T', ' ').substring(0, 19)
                : null;
              const arrAt = row.scheduled_arrival
                ? new Date(row.scheduled_arrival).toISOString().replace('T', ' ').substring(0, 19)
                : null;
              const payload = {
                trip_type: row.type || "personnel",
                origin: row.origin,
                destination: row.destination,
                scheduled_departure_at: depAt,
                scheduled_arrival_at: arrAt,
                purpose: row.purpose || null,
                priority: row.priority || "normal",
                route: row.route || null,
                cargo: row.cargo || null,
                notes: row.notes || null,
                passengers: [],
              };
              const res = await tripsApi.create(payload as any);
              if (res.success) successCount++;
              else failCount++;
            } catch {
              failCount++;
            }
          }
          fetchTrips();
          if (failCount > 0) {
            throw new Error(`${successCount} imported, ${failCount} failed`);
          }
        }}
        onDownloadTemplate={() => {
          const csv = "origin,destination,type,scheduled_departure,scheduled_arrival,purpose,priority,route,cargo,notes\nLagos,Abuja,personnel,2025-03-15 08:00:00,2025-03-15 16:00:00,Board Meeting,normal,Via Lokoja,,";
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "trips_import_template.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      />

      <TripVendorComparison trip={selectedTrip} open={comparisonOpen} onOpenChange={setComparisonOpen} />
      <JCCDialog trip={selectedTrip} open={jccOpen} onOpenChange={setJccOpen} />

    </div>
  );
};

// Export for use in other components
export default TripScheduling;
