import type { StaffTripRequest, TripViewerContext } from '@/types/trip-request';
import type { Trip } from '@/types/logistics';

export function resolveLogisticsTripId(
  trip: StaffTripRequest | Record<string, unknown> | null | undefined,
): string | null {
  if (!trip) return null;
  const raw =
    (trip as StaffTripRequest).logisticsTripId ??
    (trip as StaffTripRequest).logistics_trip_id ??
    (trip as StaffTripRequest).tripId ??
    (trip as StaffTripRequest).trip_id;
  return raw != null ? String(raw) : null;
}

export function resolveTripViewer(
  payload: Record<string, unknown> | StaffTripRequest | Trip | null | undefined,
): TripViewerContext & { readOnly: boolean; canManage: boolean; canComment: boolean } {
  if (!payload) {
    return { readOnly: true, canManage: false, canComment: false };
  }
  const p = payload as Record<string, unknown>;
  const viewer = (p.viewer ?? {}) as TripViewerContext;
  const readOnly = Boolean(p.readOnly ?? viewer.readOnly ?? false);
  const canManage = Boolean(p.canManage ?? viewer.canManage ?? false);
  const canComment = p.canComment !== undefined ? Boolean(p.canComment) : !readOnly;
  return { ...viewer, readOnly, canManage, canComment };
}
