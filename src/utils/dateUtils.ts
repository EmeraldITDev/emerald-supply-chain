/**
 * Date utility functions for formatting dates in Africa/Lagos timezone (WAT)
 */

const LAGOS_TIMEZONE = 'Africa/Lagos';

/**
 * Format a date string to a readable format in Lagos timezone
 * @param dateString - ISO date string from backend
 * @param options - Optional formatting options
 * @returns Formatted date string
 */
export const formatDateLagos = (
  dateString: string | null | undefined,
  options?: {
    includeTime?: boolean;
    includeSeconds?: boolean;
    format?: 'short' | 'medium' | 'long' | 'full';
  }
): string => {
  if (!dateString) return 'N/A';

  try {
    let date: Date;

    // Parse the date string
    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      // Has timezone info (UTC or with offset), parse directly
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      // ISO format without timezone - treat as UTC and convert to Lagos
      date = new Date(dateString + 'Z');
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Plain date string - add time and treat as UTC
      date = new Date(dateString + 'T00:00:00Z');
    } else {
      // Fallback: try parsing as-is
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string for formatting:', dateString);
      return 'Invalid Date';
    }

    const includeTime = options?.includeTime ?? true;
    const includeSeconds = options?.includeSeconds ?? false;
    const format = options?.format ?? 'medium';

    // Format options based on preferences
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: LAGOS_TIMEZONE,
    };

    if (format === 'short') {
      formatOptions.month = 'short';
      formatOptions.day = 'numeric';
      formatOptions.year = 'numeric';
    } else if (format === 'medium') {
      formatOptions.month = 'short';
      formatOptions.day = 'numeric';
      formatOptions.year = 'numeric';
    } else if (format === 'long') {
      formatOptions.month = 'long';
      formatOptions.day = 'numeric';
      formatOptions.year = 'numeric';
    } else if (format === 'full') {
      formatOptions.weekday = 'long';
      formatOptions.month = 'long';
      formatOptions.day = 'numeric';
      formatOptions.year = 'numeric';
    }

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = true;
      if (includeSeconds) {
        formatOptions.second = '2-digit';
      }
    }

    return date.toLocaleString('en-US', formatOptions);
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid Date';
  }
};

/**
 * Format a date string for MRF display (short format with time)
 */
export const formatMRFDate = (dateString: string | null | undefined): string => {
  return formatDateLagos(dateString, {
    includeTime: true,
    format: 'short',
  });
};

/**
 * Format a date string for display in approval history (with time)
 */
export const formatApprovalDate = (dateString: string | null | undefined): string => {
  return formatDateLagos(dateString, {
    includeTime: true,
    format: 'medium',
  });
};

/**
 * Get relative time string (e.g., "2 hours ago") in Lagos timezone
 * Note: This uses date-fns formatDistanceToNow which works with Date objects
 */
export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';

  try {
    let date: Date;

    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      date = new Date(dateString + 'Z');
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date-only string e.g. "2026-04-15" — treat as UTC noon to avoid day-off errors
      date = new Date(dateString + 'T12:00:00Z');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    const diffMonths = Math.round(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;

    const diffYears = Math.round(diffDays / 365);
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;

  } catch (error) {
    console.error('Error formatting relative time:', dateString, error);
    return 'Invalid Date';
  }
};
/**
 * Convert a date string to a Date object in Lagos timezone
 */
export const toLagosDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;

  try {
    let date: Date;

    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      date = new Date(dateString + 'Z');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    console.error('Error converting to Lagos date:', dateString, error);
    return null;
  }
};
