import type { VendorRegistration } from "@/types";
import { vendorApi } from "@/services/api";
import type { ApiResponse } from "@/types";

/**
 * Single source of truth for "Pending Vendor Registrations" across the app.
 * This intentionally matches the same query + filter pattern used in the Procurement dashboard.
 */
export async function getPendingVendorRegistrations(): Promise<ApiResponse<VendorRegistration[]>> {
  const res = await vendorApi.getRegistrations();
  if (!res.success || !res.data) return res;

  const pending = res.data.filter((reg) => {
    const s = (reg.status || "").toLowerCase();
    return s === "pending" || s === "under review";
  });

  return { success: true, data: pending };
}

