import type { VehicleStatus } from "@/types/logistics";

/**
 * Module 4: Centralized vehicle status display + badge mapping.
 * Backend canonical statuses are uppercase: ACTIVE | INACTIVE | UNDER_MAINTENANCE.
 * Legacy lowercase values (available, in_use, maintenance, out_of_service) are
 * passed through with a dev-only warning so we can spot stragglers.
 */

const CANONICAL: Record<string, { label: string; badgeClass: string }> = {
  ACTIVE: { label: "Active", badgeClass: "bg-success/10 text-success border-success/20" },
  INACTIVE: { label: "Inactive", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
  UNDER_MAINTENANCE: { label: "Under Maintenance", badgeClass: "bg-warning/10 text-warning border-warning/20" },
  // legacy passthrough
  available: { label: "Available", badgeClass: "bg-success/10 text-success border-success/20" },
  in_use: { label: "In Use", badgeClass: "bg-primary/10 text-primary border-primary/20" },
  maintenance: { label: "Maintenance", badgeClass: "bg-warning/10 text-warning border-warning/20" },
  out_of_service: { label: "Out of Service", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
};

const titleCase = (raw: string): string =>
  raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

export function formatVehicleStatus(status?: VehicleStatus | string | null): string {
  if (!status) return "Unknown";
  const hit = CANONICAL[status as string];
  if (hit) return hit.label;
  if (import.meta.env.DEV) {
    console.warn(`[formatVehicleStatus] Unknown vehicle status: "${status}". Falling back to title-case.`);
  }
  return titleCase(String(status));
}

export function vehicleStatusBadgeClass(status?: VehicleStatus | string | null): string {
  if (!status) return "bg-muted text-muted-foreground border-muted";
  return CANONICAL[status as string]?.badgeClass ?? "bg-muted text-muted-foreground border-muted";
}

/** Normalises any incoming status value (case-insensitive) to canonical uppercase if possible. */
export function normaliseVehicleStatus(status?: string | null): VehicleStatus | undefined {
  if (!status) return undefined;
  const upper = status.toUpperCase();
  if (upper === "ACTIVE" || upper === "INACTIVE" || upper === "UNDER_MAINTENANCE") {
    return upper as VehicleStatus;
  }
  return status as VehicleStatus;
}

export function isInactiveOrUnderMaintenance(status?: VehicleStatus | string | null): boolean {
  if (!status) return false;
  const u = String(status).toUpperCase();
  return u === "INACTIVE" || u === "UNDER_MAINTENANCE";
}