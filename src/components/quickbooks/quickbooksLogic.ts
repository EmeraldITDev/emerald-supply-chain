export const QUICKBOOKS_SYNC_ROLES = [
  "admin",
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
] as const;

export type QuickBooksCallbackError =
  | "invalid_state"
  | "access_denied"
  | "token_exchange_failed";

export interface QuickBooksStatus {
  connected: boolean;
  needs_reconnect: boolean;
  connected_at: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  dry_run: boolean;
  writes_enabled: boolean;
  default_line_ref_configured: boolean;
}

export interface QuickBooksCheck {
  check: string;
  passed: boolean;
  detail?: string | null;
}

export type QuickBooksBanner = "live" | "dry_run" | "writes_disabled" | "none";

const CALLBACK_ERRORS = new Set<QuickBooksCallbackError>([
  "invalid_state",
  "access_denied",
  "token_exchange_failed",
]);

export function canAccessQuickBooks(role?: string | null): boolean {
  return QUICKBOOKS_SYNC_ROLES.includes((role ?? "") as (typeof QUICKBOOKS_SYNC_ROLES)[number]);
}

export function isQuickBooksAdmin(role?: string | null): boolean {
  return role === "admin";
}

export function dash(value: unknown): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text === "" ? "—" : text;
}

export function quickBooksErrorMessage(code?: string | null, status?: number): string {
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403 || code === "FORBIDDEN") return "You do not have permission to do that.";
  switch (code) {
    case "QB_NOT_CONNECTED":
      return "QuickBooks is not connected.";
    case "QB_NEEDS_RECONNECT":
      return "Reconnect QuickBooks before continuing.";
    case "QB_SYNC_FAILED":
      return "QuickBooks could not sync this purchase order.";
    case "QB_VALIDATION_FAILED":
      return "This purchase order did not pass QuickBooks validation.";
    case "QB_WRITES_DISABLED":
      return "QuickBooks writes are disabled.";
    case "INVALID_STATE":
    case "invalid_state":
      return "The QuickBooks connection attempt expired or did not match. Start Connect again.";
    case "access_denied":
      return "QuickBooks access was denied.";
    case "token_exchange_failed":
      return "QuickBooks could not finish connecting. Try Connect again.";
    default:
      return "QuickBooks could not complete that request.";
  }
}

export function callbackErrorMessage(code: string | null): string | null {
  if (!code || !CALLBACK_ERRORS.has(code as QuickBooksCallbackError)) return null;
  return quickBooksErrorMessage(code);
}

export interface CallbackQueryState {
  connected: boolean;
  error: QuickBooksCallbackError | null;
}

/** Reads the real callback query (`quickbooks=connected`, `error=`) and the documented aliases. */
export function readCallbackQuery(params: URLSearchParams): CallbackQueryState {
  const connected =
    params.get("quickbooks") === "connected" || params.get("qb_connected") === "true";
  const raw = params.get("error") ?? params.get("qb_error");
  const error = raw && CALLBACK_ERRORS.has(raw as QuickBooksCallbackError)
    ? (raw as QuickBooksCallbackError)
    : null;
  return { connected, error };
}

export function stripCallbackParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  ["quickbooks", "qb_connected", "error", "qb_error", "code", "state", "realmId"].forEach((key) => {
    next.delete(key);
  });
  return next;
}

export function bannerKind(status: Pick<QuickBooksStatus, "dry_run" | "writes_enabled">): QuickBooksBanner {
  if (status.dry_run === false && status.writes_enabled === true) return "live";
  if (status.dry_run) return "dry_run";
  if (!status.writes_enabled) return "writes_disabled";
  return "none";
}

export function bannerShowsWritesDisabled(status: Pick<QuickBooksStatus, "dry_run" | "writes_enabled">): boolean {
  return status.writes_enabled === false && !(status.dry_run === false && status.writes_enabled === true);
}

export type SyncButtonState =
  | { visible: false }
  | { visible: true; disabled: true; reason: string }
  | { visible: true; disabled: false; reason: null };

export function syncButtonState(input: {
  role?: string | null;
  signed: boolean;
  connected: boolean;
  needsReconnect: boolean;
  pending: boolean;
}): SyncButtonState {
  if (!canAccessQuickBooks(input.role)) return { visible: false };
  if (input.pending) return { visible: true, disabled: true, reason: "Sync is already in progress." };
  if (!input.signed) return { visible: true, disabled: true, reason: "This purchase order is not signed." };
  if (input.needsReconnect) return { visible: true, disabled: true, reason: "Reconnect QuickBooks before syncing." };
  if (!input.connected) return { visible: true, disabled: true, reason: "QuickBooks is not connected." };
  return { visible: true, disabled: false, reason: null };
}

export function syncStatusLabel(status?: string | null): "Not synced" | "Synced" | "Failed" | "Dry-run passed" {
  const value = (status ?? "").trim().toLowerCase();
  if (!value) return "Not synced";
  if (value === "failed" || value === "error") return "Failed";
  if (value === "dry-run passed" || value === "dry_run") return "Dry-run passed";
  return "Synced";
}
