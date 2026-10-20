import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

/** 0.4 -> "< 1m", 42 -> "42m", 134 -> "2j 14m", 1500 -> "1h 1j". */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 1) return '< 1m';
  const total = Math.round(minutes);
  if (total < MINUTES_PER_HOUR) return `${total}m`;
  if (total < MINUTES_PER_DAY) {
    const rest = total % MINUTES_PER_HOUR;
    return rest > 0 ? `${Math.floor(total / MINUTES_PER_HOUR)}j ${rest}m` : `${total / MINUTES_PER_HOUR}j`;
  }
  const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return `${Math.floor(total / MINUTES_PER_DAY)}h ${hours}j`;
}

/** Relative change in percent, or null when there's nothing to compare against. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Share in percent (0-100), or null when the total is 0. */
export function ratePercent(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

/** 'YYYY-MM-DD' -> "20 Okt". */
export function formatDayLabel(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM', { locale: idLocale });
}

/** 'YYYY-MM-DD' -> "Senin, 20 Okt 2026". */
export function formatFullDay(isoDate: string): string {
  return format(parseISO(isoDate), 'EEEE, d MMM yyyy', { locale: idLocale });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
}
