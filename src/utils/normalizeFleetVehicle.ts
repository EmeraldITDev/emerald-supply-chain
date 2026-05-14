import type { FleetVehicle, VehicleDocument } from "@/types/logistics";

const DOC_TYPES: VehicleDocument["type"][] = [
  "registration",
  "insurance",
  "roadworthiness",
  "license",
  "permit",
  "other",
];

/** Map one document row from GET list or embedded vehicle payload. */
export function mapFleetListDocument(d: any, vehicleId: string): VehicleDocument {
  const raw = String(d.type || d.document_type || "other").toLowerCase();
  const type = DOC_TYPES.includes(raw as VehicleDocument["type"])
    ? (raw as VehicleDocument["type"])
    : "other";
  return {
    id: String(d.id ?? ""),
    vehicleId,
    type,
    name: String(d.name || d.file_name || d.document_type || "Document"),
    uploadedAt: String(d.uploaded_at || d.uploadedAt || d.created_at || ""),
    fileUrl: d.file_url || d.fileUrl,
    expiresAt: d.expires_at || d.expiry_date || d.expiryDate,
    documentType: d.document_type || d.documentType,
    expiryDate: d.expiry_date || d.expiryDate,
    alertColour: d.alert_colour || d.alertColour,
  };
}

/** Maps API / snake_case fleet vehicle payloads to {@link FleetVehicle}. */
export function normalizeFleetVehicle(raw: any): FleetVehicle {
  return {
    id: raw.id != null ? String(raw.id) : "",
    vehicleNumber:
      raw.vehicle_number ||
      raw.vehicleNumber ||
      (raw.id != null ? `VEH-${raw.id}` : "") ||
      "",
    plate: (raw.plate || raw.plate_number || raw.registration_number || raw.registrationNumber || "").trim(),
    name: raw.name || raw.vehicle_name || "",
    type: raw.type || raw.vehicle_type || "",
    make: raw.make || "",
    model: raw.model || "",
    year: raw.year ? Number(raw.year) : undefined,
    color: raw.color || "",
    ownership: raw.ownership || "owned",
    vendorId: raw.vendor_id?.toString() || raw.vendorId,
    vendorName: raw.vendor?.name || raw.vendor_name || raw.vendorName || "",
    status: raw.status || "available",
    approvalStatus: raw.approval_status || raw.approvalStatus || "pending",
    approvedBy: raw.approved_by || raw.approvedBy,
    approvedAt: raw.approved_at || raw.approvedAt,
    passengerCapacity: raw.passenger_capacity ?? raw.passengerCapacity ?? raw.capacity_passengers,
    cargoCapacity:
      raw.cargo_capacity ?? raw.cargoCapacity ?? raw.cargo_capacity_kg ?? raw.capacity_cargo,
    fuelType: raw.fuel_type || raw.fuelType || "",
    fuelCapacity: raw.fuel_capacity != null ? Number(raw.fuel_capacity) : raw.fuelCapacity,
    documents: Array.isArray(raw.documents)
      ? raw.documents.map((d: any) => mapFleetListDocument(d, raw.id != null ? String(raw.id) : ""))
      : [],
    lastMaintenanceAt: raw.last_maintenance_at || raw.lastMaintenanceAt,
    nextMaintenanceAt: raw.next_maintenance_at || raw.nextMaintenanceAt,
    maintenanceHistory: raw.maintenance_history || raw.maintenanceHistory || [],
    currentDriverId: raw.current_driver_id?.toString() || raw.currentDriverId,
    currentDriverName: raw.current_driver_name || raw.currentDriverName,
    currentTripId: raw.current_trip_id?.toString() || raw.currentTripId,
    totalTrips: raw.total_trips || raw.totalTrips || 0,
    totalDistance: raw.total_distance || raw.totalDistance || 0,
    gpsEnabled: raw.gps_enabled || raw.gpsEnabled,
    gpsDeviceId: raw.gps_device_id || raw.gpsDeviceId,
    lastKnownLocation: raw.last_known_location || raw.lastKnownLocation,
    createdAt: raw.created_at || raw.createdAt || "",
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}

/** Plate / reg / fleet number for UI when plate is missing. */
export function displayFleetVehiclePlate(v: Pick<FleetVehicle, "plate" | "vehicleNumber" | "id">): string {
  const plate = (v.plate || "").trim();
  if (plate) return plate;
  const num = (v.vehicleNumber || "").trim();
  if (num) return num;
  return v.id ? `ID ${v.id}` : "—";
}
