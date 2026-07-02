import { queryClient } from "@/lib/queryClient";
import { clearFinanceRoutingConfigCache } from "@/services/financeRoutingConfig";

const STAFF_AUTH_KEYS = [
  "authToken",
  "userData",
  "isAuthenticated",
  "tokenExpiry",
] as const;

const VENDOR_AUTH_KEYS = [
  "vendorAuthToken",
  "vendorData",
  "vendorTokenExpiry",
] as const;

export function getStoredStaffAuthToken(): string | null {
  return localStorage.getItem("authToken") ?? sessionStorage.getItem("authToken");
}

export function getStoredVendorAuthToken(): string | null {
  return (
    localStorage.getItem("vendorAuthToken") ?? sessionStorage.getItem("vendorAuthToken")
  );
}

/** Wipe staff SCM session from memory and storage — synchronous, must not await network. */
export function clearStaffAuthStorage(): void {
  clearFinanceRoutingConfigCache();
  for (const key of STAFF_AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  void queryClient.cancelQueries();
  queryClient.clear();
}

/** Wipe vendor portal session from storage — synchronous. */
export function clearVendorAuthStorage(): void {
  for (const key of VENDOR_AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
