import React, { useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';
import { autoReplyApi } from '@/lib/api';
import type { AutoReplySettings } from '@/types';

const DAY_OPTIONS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: "Jum'at" },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
];

const EMPTY_SETTINGS: AutoReplySettings = {
  isEnabled: false,
  message: '',
  workingDays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '17:00',
  updatedAt: null,
};

export default function AutoReplyTab() {
  const [settings, setSettings] = useState<AutoReplySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await autoReplyApi.getSettings();
      setSettings(response.settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load auto-reply settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setSettings((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      const response = await autoReplyApi.updateSettings({
        isEnabled: settings.isEnabled,
        message: settings.message,
        workingDays: settings.workingDays,
        startTime: settings.startTime,
        endTime: settings.endTime,
      });
      setSettings(response.settings);
      setSaved(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save auto-reply settings';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Memuat pengaturan...</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-saas-text-primary">Balas Otomatis di Luar Jam Kerja</h2>
        <p className="text-gray-600 mt-1">
          Kirim balasan otomatis ke pelanggan yang chat di luar jam kerja. Percakapan tetap muncul di tab
          &quot;Belum Dibalas&quot; supaya admin tetap bisa menindaklanjuti.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
          <p className="text-green-800 font-semibold">Pengaturan berhasil disimpan</p>
        </div>
      )}

      <div className="bg-white border-2 border-saas-border rounded-2xl p-6 space-y-6">
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={settings.isEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, isEnabled: e.target.checked }))}
            className="w-5 h-5 accent-saas-primary-blue"
          />
          <span className="font-semibold text-saas-text-primary">Aktifkan balas otomatis</span>
        </label>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Hari Kerja</label>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  settings.workingDays.includes(day.value)
                    ? 'bg-saas-primary-blue text-white shadow-soft-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jam Mulai</label>
            <div className="relative">
              <Clock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="time"
                value={settings.startTime}
                onChange={(e) => setSettings((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full pl-11 pr-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jam Selesai</label>
            <div className="relative">
              <Clock className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="time"
                value={settings.endTime}
                onChange={(e) => setSettings((prev) => ({ ...prev, endTime: e.target.value }))}
                className="w-full pl-11 pr-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-3">
          Di luar hari &amp; jam ini, pesan masuk akan dibalas otomatis (maksimal sekali per 24 jam per percakapan).
        </p>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Narasi Balasan Otomatis</label>
          <textarea
            value={settings.message}
            onChange={(e) => setSettings((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Contoh: Terima kasih telah menghubungi kami. Saat ini di luar jam operasional kami (09:00-17:00 WIB, Senin-Jumat). Tim kami akan membalas pesan Anda secepatnya."
            rows={5}
            className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium resize-none"
          />
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving || (settings.isEnabled && !settings.message.trim())}
          className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
}
