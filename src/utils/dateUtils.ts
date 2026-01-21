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

    // Parse the date string - ensure UTC dates are properly handled
    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
      date = new Date(dateString);
    } else if (dateString.includes('T')) {
      // Treat as UTC if no timezone specified
      date = new Date(dateString + 'Z');
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    // Convert UTC date to Lagos timezone for accurate relative time calculation
    // Get the time in Lagos timezone
    const lagosDateStr = date.toLocaleString('en-US', { 
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse the Lagos time string back to a Date object
    // Format: "MM/DD/YYYY, HH:MM:SS"
    const [datePart, timePart] = lagosDateStr.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    const lagosDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    // Use date-fns formatDistanceToNow
    const { formatDistanceToNow } = require('date-fns');
    return formatDistanceToNow(lagosDate, { addSuffix: true });
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
