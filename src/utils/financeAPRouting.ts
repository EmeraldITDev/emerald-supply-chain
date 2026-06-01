/**
 * Phase 7: Finance AP Routing Utilities
 * Determines whether an MRF should be routed to Finance AP or legacy internal finance
 * based on the MRF creation date and configured cutover date.
 */

import type { MRF } from '@/types';

/**
 * Get the Finance AP cutover date from environment
 * @returns ISO date string or null if not configured
 */
export function getFinanceAPCutoverDate(): string | null {
  const cutoverDate = import.meta.env.VITE_FINANCE_AP_CUTOVER_DATE;
  return cutoverDate && cutoverDate.trim() ? cutoverDate.trim() : null;
}

/**
 * Check if an MRF uses Finance AP routing
 * Rule: created_at >= FINANCE_AP_CUTOVER_DATE
 * @param mrf - The MRF to check
 * @returns true if MRF should be routed to Finance AP, false for legacy internal
 */
export function mrfUsesFinanceAp(mrf: MRF): boolean {
  const cutoverDate = getFinanceAPCutoverDate();
  
  // If no cutover date configured, all MRFs use legacy internal finance
  if (!cutoverDate) {
    return false;
  }

  // Get MRF creation date
  const mrfCreatedAt = mrf.created_at || mrf.date;
  if (!mrfCreatedAt) {
    // If no creation date available, assume legacy
    return false;
  }

  try {
    const cutoverDateTime = new Date(cutoverDate).getTime();
    const mrfDateTime = new Date(mrfCreatedAt).getTime();
    return mrfDateTime >= cutoverDateTime;
  } catch {
    console.warn('Invalid date format for Finance AP cutover comparison:', { cutoverDate, mrfCreatedAt });
    return false;
  }
}

/**
 * Get the finance route for an MRF
 * @param mrf - The MRF to check
 * @returns 'finance_ap' or 'legacy_internal'
 */
export function getFinanceRoute(mrf: MRF): 'finance_ap' | 'legacy_internal' {
  return mrfUsesFinanceAp(mrf) ? 'finance_ap' : 'legacy_internal';
}

/**
 * Get a human-readable description of the current routing configuration
 * @returns Description string
 */
export function getFinanceRoutingDescription(): string {
  const cutoverDate = getFinanceAPCutoverDate();
  
  if (!cutoverDate) {
    return 'All MRFs are routed to legacy internal finance (Finance AP cutover date not configured)';
  }

  try {
    const date = new Date(cutoverDate);
    const formatted = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    return `MRFs created on or after ${formatted} are routed to Finance AP; earlier MRFs use legacy internal finance`;
  } catch {
    return `Finance AP cutover configured but date invalid: ${cutoverDate}`;
  }
}

/**
 * Check if Finance AP routing is fully configured
 * @returns true if a valid cutover date is set
 */
export function isFinanceAPRoutingConfigured(): boolean {
  const cutoverDate = getFinanceAPCutoverDate();
  if (!cutoverDate) return false;
  
  try {
    // Validate it's a valid ISO date
    new Date(cutoverDate);
    return true;
  } catch {
    return false;
  }
}
