import type { StaffTripRequest, TripUiDeleteDraft } from '@/types/trip-request';

export function tripCanDeleteDraft(trip: StaffTripRequest): boolean {
  if (trip.canDelete === true) return true;
  return Boolean(trip.ui?.deleteDraft?.showButton && trip.ui.deleteDraft.path);
}

export function tripDeleteDraftAction(trip: StaffTripRequest): TripUiDeleteDraft | null {
  if (!tripCanDeleteDraft(trip)) return null;
  return trip.ui?.deleteDraft ?? null;
}
