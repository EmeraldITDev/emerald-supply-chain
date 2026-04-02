import type { VendorRegistration } from "@/types";
import { dashboardApi } from "@/services/api";
import type { ApiResponse } from "@/types";

/**
 * Single source of truth for "Pending Vendor Registrations" across the app.
 * This uses the same working endpoint as the Procurement dashboard:
 * /dashboard/procurement-manager -> pendingRegistrations
 */
export async function getPendingVendorRegistrations(): Promise<ApiResponse<VendorRegistration[]>> {
  const res = await dashboardApi.getProcurementManagerDashboard();
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "Failed to load pending vendor registrations" };
  }

  const raw = (res.data as any).pendingRegistrations;
  const registrations = Array.isArray(raw) ? raw : [];
  const normalizeStatus = (s: unknown) => String(s || "").trim().toLowerCase().replace(/_/g, " ");

  // Keep same visible behavior: only Pending/Under Review
  const pending = registrations
    .filter((reg: any) => {
      const status = normalizeStatus(reg.status);
      return status === "pending" || status === "under review";
    })
    .map((reg: any) => ({
      id: reg.id,
      companyName: reg.companyName || reg.company_name || "",
      category: reg.category || "",
      email: reg.email || "",
      phone: reg.phone || "",
      address: reg.address || "",
      taxId: reg.taxId || reg.tax_id || "",
      contactPerson: reg.contactPerson || reg.contact_person || "",
      status: "Pending",
      submittedDate: reg.submittedDate || reg.submitted_date || reg.createdAt || reg.created_at || "",
      createdAt: reg.createdAt || reg.created_at || "",
      documents: reg.documents || [],
    })) as VendorRegistration[];

  return { success: true, data: pending };
}

