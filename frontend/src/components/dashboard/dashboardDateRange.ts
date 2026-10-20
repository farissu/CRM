import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { DashboardDateRange } from '@/types';

// Mirrors the backend: default window is the last 30 days, longest allowed is 366.
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
const MS_DAY = 86_400_000;
const BUSINESS_TZ = 'Asia/Jakarta';

/** Today's calendar date in the business timezone, 'YYYY-MM-DD' (en-CA formats as ISO). */
export function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date());
}

function toUtc(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate) + days * MS_DAY).toISOString().slice(0, 10);
}

export function inclusiveDayCount({ startDate, endDate }: DashboardDateRange): number {
  return Math.round((toUtc(endDate) - toUtc(startDate)) / MS_DAY) + 1;
}

export interface RangePreset {
  key: string;
  label: string;
  /** Lower-case phrase used inside sentences, e.g. "Pesan masuk · 30 hari terakhir". */
  phrase: string;
  resolve: (today: string) => DashboardDateRange;
}

const lastDays = (n: number) => (today: string): DashboardDateRange => ({ startDate: addDays(today, -(n - 1)), endDate: today });

export const RANGE_PRESETS: RangePreset[] = [
  { key: 'today', label: 'Hari ini', phrase: 'hari ini', resolve: lastDays(1) },
  { key: '7d', label: '7 hari terakhir', phrase: '7 hari terakhir', resolve: lastDays(7) },
  { key: '30d', label: '30 hari terakhir', phrase: '30 hari terakhir', resolve: lastDays(30) },
  { key: '90d', label: '90 hari terakhir', phrase: '90 hari terakhir', resolve: lastDays(90) },
  {
    key: 'this-month',
    label: 'Bulan ini',
    phrase: 'bulan ini',
    resolve: (today) => ({ startDate: `${today.slice(0, 8)}01`, endDate: today }),
  },
  {
    key: 'last-month',
    label: 'Bulan lalu',
    phrase: 'bulan lalu',
    resolve: (today) => {
      const endDate = addDays(`${today.slice(0, 8)}01`, -1);
      return { startDate: `${endDate.slice(0, 8)}01`, endDate };
    },
  },
];

export function defaultDateRange(today: string = businessToday()): DashboardDateRange {
  return lastDays(DEFAULT_RANGE_DAYS)(today);
}

export function matchPreset(range: DashboardDateRange, today: string = businessToday()): RangePreset | undefined {
  return RANGE_PRESETS.find((p) => {
    const r = p.resolve(today);
    return r.startDate === range.startDate && r.endDate === range.endDate;
  });
}

/** "20 Okt 2026", "1 – 15 Okt 2026", "21 Sep – 20 Okt 2026", "21 Des 2025 – 5 Jan 2026". */
export function formatRange({ startDate, endDate }: DashboardDateRange): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: idLocale });
  if (startDate === endDate) return fmt(end, 'd MMM yyyy');
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) return `${fmt(start, 'd')} – ${fmt(end, 'd MMM yyyy')}`;
  if (startDate.slice(0, 4) === endDate.slice(0, 4)) return `${fmt(start, 'd MMM')} – ${fmt(end, 'd MMM yyyy')}`;
  return `${fmt(start, 'd MMM yyyy')} – ${fmt(end, 'd MMM yyyy')}`;
}

/** Phrase for card subtitles: a preset's name when it matches, otherwise the dates. */
export function describeRange(range: DashboardDateRange): string {
  return matchPreset(range)?.phrase ?? formatRange(range);
}

/** Null when valid, otherwise a message the picker can show. */
export function validateRange(range: DashboardDateRange, today: string = businessToday()): string | null {
  if (!range.startDate || !range.endDate) return 'Pilih tanggal mulai dan selesai';
  if (range.startDate > range.endDate) return 'Tanggal mulai harus sebelum tanggal selesai';
  if (range.endDate > today) return 'Tanggal selesai tidak boleh melewati hari ini';
  if (inclusiveDayCount(range) > MAX_RANGE_DAYS) return `Rentang maksimal ${MAX_RANGE_DAYS} hari`;
  return null;
}
