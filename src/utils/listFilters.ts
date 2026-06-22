/**
 * Shared search / status / date-range / sort logic for list views
 * (MRF list, SRF list, PO list). Keeps filtering behaviour consistent.
 *
 * Persistence note: callers hold this state in component `useState`, so it
 * persists while the page is mounted and resets when the user navigates away
 * and returns (component unmount) — exactly the desired behaviour.
 */

export type ListSort = "newest" | "oldest" | "value-desc" | "value-asc";

export interface ListControlsState {
  /** Free-text query matched against each item's searchable text. */
  search: string;
  /** Status filter key; "all" means no status filter. */
  status: string;
  /** Inclusive start date (yyyy-mm-dd) or "" for no lower bound. */
  dateFrom: string;
  /** Inclusive end date (yyyy-mm-dd) or "" for no upper bound. */
  dateTo: string;
  /** Sort order. */
  sort: ListSort;
}

export function defaultListControls(): ListControlsState {
  return { search: "", status: "all", dateFrom: "", dateTo: "", sort: "newest" };
}

export interface ListAccessors<T> {
  /** Concatenated, lower-cased-on-compare text used for the search match. */
  searchText: (item: T) => string;
  /** Creation / submission date for the date-range filter and date sort. */
  date: (item: T) => string | number | Date | null | undefined;
  /** Monetary value used by value-based sorting. */
  value: (item: T) => number;
  /** Optional status predicate; only called when state.status !== "all". */
  matchesStatus?: (item: T, status: string) => boolean;
}

function toTime(value: string | number | Date | null | undefined): number {
  if (value == null || value === "") return NaN;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Count the number of non-default (active) filters, for badge display. */
export function countActiveListFilters(state: ListControlsState): number {
  let n = 0;
  if (state.status && state.status !== "all") n += 1;
  if (state.dateFrom) n += 1;
  if (state.dateTo) n += 1;
  return n;
}

/** Apply search + status + date-range filtering and sorting to a list. */
export function applyListControls<T>(
  items: T[],
  state: ListControlsState,
  accessors: ListAccessors<T>,
): T[] {
  let out = Array.isArray(items) ? [...items] : [];

  const needle = state.search.trim().toLowerCase();
  if (needle) {
    out = out.filter((it) =>
      accessors.searchText(it).toLowerCase().includes(needle),
    );
  }

  if (state.status && state.status !== "all" && accessors.matchesStatus) {
    out = out.filter((it) => accessors.matchesStatus!(it, state.status));
  }

  if (state.dateFrom) {
    const from = toTime(state.dateFrom);
    if (!Number.isNaN(from)) {
      out = out.filter((it) => {
        const t = toTime(accessors.date(it));
        return Number.isNaN(t) ? false : t >= from;
      });
    }
  }

  if (state.dateTo) {
    // Make the end date inclusive of the whole day.
    const to = toTime(state.dateTo);
    if (!Number.isNaN(to)) {
      const endOfDay = to + 24 * 60 * 60 * 1000 - 1;
      out = out.filter((it) => {
        const t = toTime(accessors.date(it));
        return Number.isNaN(t) ? false : t <= endOfDay;
      });
    }
  }

  out.sort((a, b) => {
    if (state.sort === "value-desc") return accessors.value(b) - accessors.value(a);
    if (state.sort === "value-asc") return accessors.value(a) - accessors.value(b);
    const ta = toTime(accessors.date(a));
    const tb = toTime(accessors.date(b));
    const sa = Number.isNaN(ta) ? 0 : ta;
    const sb = Number.isNaN(tb) ? 0 : tb;
    return state.sort === "oldest" ? sa - sb : sb - sa;
  });

  return out;
}
