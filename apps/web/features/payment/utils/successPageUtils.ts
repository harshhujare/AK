/**
 * successPageUtils.ts
 *
 * Pure utility functions for the /payment/success page.
 * All functions are side-effect free and independently unit-tested.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maps planDuration (days) → human-readable label. Keep in sync with pricing/page.tsx PLANS. */
export const PLAN_DURATION_LABELS: Record<number, string> = {
  30: 'Monthly',
  180: '6-Month',
  365: 'Annual',
};

// ─── parseSuccessParams ────────────────────────────────────────────────────────

export interface SuccessParams {
  planLabel: string;
  expiresAt: Date;
}

/**
 * Parse and validate the URL search params written by useCheckout on navigation.
 *
 * Expected params:
 *   plan    — human-readable label string (e.g. "Monthly", "Annual")
 *   expires — ISO 8601 date string (e.g. "2025-08-30T00:00:00.000Z")
 *
 * Returns `null` (triggers redirect to `/`) if:
 *   - Either param is missing or empty
 *   - `expires` does not parse to a valid Date
 *   - `expires` is more than 1 year in the past (sanity / stale URL guard)
 */
export function parseSuccessParams(
  searchParams: URLSearchParams
): SuccessParams | null {
  const planLabel = searchParams.get('plan')?.trim();
  const expiresRaw = searchParams.get('expires')?.trim();

  if (!planLabel || !expiresRaw) return null;

  const expiresAt = new Date(expiresRaw);

  // Guard: must be a valid date
  if (isNaN(expiresAt.getTime())) return null;

  // Guard: not more than 1 year in the past (stale / fabricated URL defence)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (expiresAt < oneYearAgo) return null;

  return { planLabel, expiresAt };
}

// ─── formatExpiryDate ─────────────────────────────────────────────────────────

/** Formatter instance — created once, reused across calls. */
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * Format a Date as "DD MMM YYYY" using Intl.DateTimeFormat (en-IN locale).
 *
 * Returns `""` for null or invalid Date inputs — callers should handle this
 * by showing a fallback string rather than crashing.
 *
 * Examples:
 *   formatExpiryDate(new Date('2025-08-30')) → "30 Aug 2025"
 *   formatExpiryDate(null)                  → ""
 *   formatExpiryDate(new Date('invalid'))   → ""
 */
export function formatExpiryDate(date: Date | null): string {
  if (!date) return '';
  if (isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

// ─── planDurationToLabel ──────────────────────────────────────────────────────

/**
 * Convert a numeric plan duration (days) to a human-readable label.
 * Falls back to "Premium" for unknown/null/undefined durations.
 *
 * Examples:
 *   planDurationToLabel(30)   → "Monthly"
 *   planDurationToLabel(180)  → "6-Month"
 *   planDurationToLabel(365)  → "Annual"
 *   planDurationToLabel(null) → "Premium"
 *   planDurationToLabel(90)   → "Premium"  (unknown duration)
 */
export function planDurationToLabel(
  duration: number | null | undefined
): string {
  if (duration == null) return 'Premium';
  return PLAN_DURATION_LABELS[duration] ?? 'Premium';
}
