/**
 * Marker set by the dashboard MRF loader on rows the backend returned in the
 * `pending_for_role` slice. Kept in its own module so queue classifiers can
 * read it without pulling in the API client.
 */
export const PENDING_FOR_ROLE_FLAG = "__pendingForRole" as const;
