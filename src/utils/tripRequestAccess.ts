/** Roles that cannot submit staff trip requests (per backend spec). */
const TRIP_REQUEST_BLOCKED_ROLES = new Set([
  "vendor",
  "admin",
  "executive",
  "chairman",
]);

/** Any authenticated staff role except vendor, admin, executive, chairman. */
export function canCreateTripRequest(role?: string | null): boolean {
  if (!role) return false;
  return !TRIP_REQUEST_BLOCKED_ROLES.has(role.toLowerCase().trim());
}
