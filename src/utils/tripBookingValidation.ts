import type { TripBookingScope, TripBookingScopeRule } from '@/types/trip-request';

export const DEFAULT_BOOKING_RULES: TripBookingScopeRule[] = [
  {
    value: 'out_of_state_local',
    label: 'Out of State (Local)',
    minimumLeadDays: 7,
    violationMessage:
      'Out of state (local) trips must be requested at least 7 calendar days before the travel date.',
  },
  {
    value: 'international',
    label: 'International (Out of Nigeria)',
    minimumLeadDays: 14,
    violationMessage:
      'International trips must be requested at least 14 calendar days before the travel date.',
  },
];

function startOfCalendarDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Earliest allowed trip date (calendar day) for a scope. */
export function minimumTripDate(referenceDate: string, minimumLeadDays: number): Date {
  const ref = startOfCalendarDay(new Date(referenceDate));
  ref.setDate(ref.getDate() + minimumLeadDays);
  return ref;
}

export function validateTripBookingLeadTime(
  departureIso: string,
  bookingScope: TripBookingScope,
  rules: TripBookingScopeRule[],
  referenceDate: string,
): { valid: boolean; violationMessage?: string; minimumDate?: Date } {
  const rule = rules.find((r) => r.value === bookingScope);
  if (!rule) {
    return { valid: true };
  }

  const minDate = minimumTripDate(referenceDate, rule.minimumLeadDays);
  const tripDay = startOfCalendarDay(new Date(departureIso));

  if (tripDay.getTime() < minDate.getTime()) {
    return {
      valid: false,
      violationMessage: rule.violationMessage,
      minimumDate: minDate,
    };
  }

  return { valid: true, minimumDate: minDate };
}

export function formatMinimumTripDateHint(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
