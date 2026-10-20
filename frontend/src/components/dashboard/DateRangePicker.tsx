'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { DashboardDateRange } from '@/types';
import { businessToday, formatRange, matchPreset, RANGE_PRESETS, validateRange } from './dashboardDateRange';

interface DateRangePickerProps {
  value: DashboardDateRange;
  onChange: (range: DashboardDateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardDateRange>(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = businessToday();
  const activePreset = matchPreset(value, today);
  const draftError = validateRange(draft, today);

  // Close on a click outside the picker or on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const open = () => {
    setDraft(value);
    setIsOpen(true);
  };

  const apply = (range: DashboardDateRange) => {
    onChange(range);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex items-center gap-2 text-sm font-semibold bg-white text-saas-text-primary rounded-lg px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <CalendarDays className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="whitespace-nowrap">{formatRange(value)}</span>
        {activePreset && <span className="hidden sm:inline text-xs font-medium text-gray-400">({activePreset.label})</span>}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Pilih rentang tanggal"
          className="absolute z-30 mt-2 left-0 sm:left-auto sm:right-0 w-[320px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-saas-border shadow-soft-lg p-4 text-saas-text-primary"
        >
          <p className="text-xs font-semibold text-gray-500 mb-2">Pilihan cepat</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => apply(preset.resolve(today))}
                className={`text-sm px-3 py-2 rounded-lg border text-left ${
                  activePreset?.key === preset.key
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-saas-border hover:bg-saas-bg'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 mb-2">Rentang khusus</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">
              Dari
              <input
                type="date"
                value={draft.startDate}
                max={draft.endDate || today}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                className="mt-1 w-full px-2 py-1.5 border border-saas-border rounded-lg text-sm text-saas-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="text-xs text-gray-500">
              Sampai
              <input
                type="date"
                value={draft.endDate}
                min={draft.startDate}
                max={today}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                className="mt-1 w-full px-2 py-1.5 border border-saas-border rounded-lg text-sm text-saas-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          {draftError && <p className="text-xs text-red-600 mt-2">{draftError}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 hover:bg-saas-bg"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => apply(draft)}
              disabled={draftError !== null}
              className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
