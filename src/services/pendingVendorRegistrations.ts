import type { VendorRegistration } from "@/types";
import { vendorApi } from "@/services/api";
import type { ApiResponse } from "@/types";

/**
 * Single source of truth for "Pending Vendor Registrations" across the app.
 * Uses the direct vendor registrations endpoint: /vendors/registrations
 */
export async function getPendingVendorRegistrations(): Promise<ApiResponse<VendorRegistration[]>> {
  const res = await vendorApi.getRegistrations();
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "Failed to load pending vendor registrations" };
  }

  const normalizeStatus = (s: unknown) => String(s || "").trim().toLowerCase().replace(/_/g, " ");

  const pending = res.data.filter((reg) => {
    const status = normalizeStatus(reg.status);
    return status === "pending" || status === "under review";
  });

  return { success: true, data: pending };
}
