// Calendar-date helpers for the Asia/Jakarta business timezone (UTC+7, no DST).
// Dates are 'YYYY-MM-DD' strings; instants are UTC Dates, matching how message
// timestamps are stored (naive UTC).
const MS_DAY = 86_400_000;
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects e.g. 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The UTC instant at which a Jakarta calendar date begins. */
export function jakartaDayStart(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - TZ_OFFSET_MS);
}

/** Today's Jakarta calendar date. */
export function jakartaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** `isoDate` shifted by `days` calendar days (negative goes back). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * MS_DAY).toISOString().slice(0, 10);
}

/** Number of calendar days in the inclusive range [startDate, endDate]. */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  return Math.round((jakartaDayStart(endDate).getTime() - jakartaDayStart(startDate).getTime()) / MS_DAY) + 1;
}
