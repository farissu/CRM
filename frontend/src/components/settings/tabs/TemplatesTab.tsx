import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, X, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import type { Agent, MessageTemplate, TemplateCategory, TemplateComponent } from '@/types';
import { templateApi } from '@/lib/api';

interface TemplatesTabProps {
  agent?: Agent;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  PENDING: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> },
  PAUSED: { label: 'Paused', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  DISABLED: { label: 'Disabled', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const LANGUAGE_OPTIONS = [
  { value: 'id', label: 'Indonesian (id)' },
  { value: 'en_US', label: 'English (en_US)' },
  { value: 'en', label: 'English (en)' },
];

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promosi, penawaran, atau konten pemasaran' },
  { value: 'UTILITY', label: 'Utility', description: 'Update pesanan, notifikasi akun, info transaksi' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'OTP dan pesan verifikasi' },
];

const DEFAULT_FORM = {
  name: '',
  language: 'id',
  category: 'MARKETING' as TemplateCategory,
  headerText: '',
  bodyText: '',
  footerText: '',
  buttons: [] as Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>,
};

export default function TemplatesTab({ agent }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.companyId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await templateApi.getTemplates();
      setTemplates(res.templates);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await templateApi.syncTemplates();
      setTemplates(res.templates);
      setSuccess('Templates berhasil disinkronkan dari Meta!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus template ini? Aksi ini tidak bisa dibatalkan.')) return;
    try {
      setDeletingId(id);
      setError(null);
      await templateApi.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setSuccess('Template berhasil dihapus.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.name) { setError('Nama template wajib diisi'); return; }
    if (!form.bodyText) { setError('Body pesan wajib diisi'); return; }
    if (!/^[a-z0-9_]+$/.test(form.name)) {
      setError('Nama template hanya boleh huruf kecil, angka, dan underscore');
      return;
    }

    const components: TemplateComponent[] = [];

    if (form.headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: form.headerText });
    }

    components.push({ type: 'BODY', text: form.bodyText });

    if (form.footerText) {
      components.push({ type: 'FOOTER', text: form.footerText });
    }

    if (form.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: form.buttons.map(b =>
          b.type === 'URL'
            ? { type: 'URL' as const, text: b.text, url: b.url ?? '' }
            : { type: 'QUICK_REPLY' as const, text: b.text }
        ),
      });
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await templateApi.createTemplate({
        name: form.name,
        language: form.language,
        category: form.category,
        components,
      });
      setTemplates(prev => [res.template, ...prev]);
      setForm(DEFAULT_FORM);
      setShowForm(false);
      setSuccess('Template berhasil disubmit ke Meta! Akan diulas dalam 24–48 jam.');
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to create template');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const addButton = (type: 'QUICK_REPLY' | 'URL') => {
    if (form.buttons.length >= 3) { setError('Maksimal 3 tombol'); return; }
    setForm(prev => ({ ...prev, buttons: [...prev.buttons, { type, text: '', url: '' }] }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => i === index ? { ...b, [field]: value } : b),
    }));
  };

  const removeButton = (index: number) => {
    setForm(prev => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }));
  };

  const getComponentText = (template: MessageTemplate, type: string) =>
    template.components.find(c => c.type === type)?.text ?? '';

  const statusCfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-saas-text-primary">Message Templates</h2>
          <p className="text-gray-600 mt-1 text-sm">Buat template pesan WhatsApp yang perlu disetujui Meta sebelum digunakan untuk broadcast.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSync()}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border-2 border-saas-border rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync dari Meta
          </button>
          <button
            onClick={() => { setShowForm(true); setError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white rounded-xl text-sm font-semibold transition-all shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Template
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-800 font-semibold text-sm">{success}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-saas-primary-blue p-6 mb-6 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-saas-text-primary">Buat Template Baru</h3>
            <button onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); setError(null); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Template *</label>
                <p className="text-xs text-gray-400 mb-1.5">Hanya huruf kecil, angka, underscore — contoh: promo_lebaran_2024</p>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="nama_template"
                  className="w-full px-3 py-2.5 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bahasa *</label>
                <p className="text-xs text-gray-400 mb-1.5">Pilih bahasa template</p>
                <select
                  value={form.language}
                  onChange={e => setForm(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none text-sm"
                >
                  {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori *</label>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORY_OPTIONS.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.category === cat.value ? 'border-saas-primary-blue bg-blue-50' : 'border-saas-border hover:border-gray-300'}`}
                  >
                    <div className="font-semibold text-sm">{cat.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Header (opsional)</label>
              <input
                type="text"
                value={form.headerText}
                onChange={e => setForm(prev => ({ ...prev, headerText: e.target.value }))}
                placeholder="Teks header pesan"
                maxLength={60}
                className="w-full px-3 py-2.5 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Body *</label>
              <p className="text-xs text-gray-400 mb-1.5">Gunakan {`{{1}}, {{2}}`} untuk variabel dinamis (nama pelanggan, nomor order, dll)</p>
              <textarea
                value={form.bodyText}
                onChange={e => setForm(prev => ({ ...prev, bodyText: e.target.value }))}
                placeholder={`Contoh:\nHai {{1}}, pesanan Anda dengan nomor {{2}} sudah kami proses dan akan dikirim dalam 2-3 hari kerja.`}
                rows={4}
                maxLength={1024}
                className="w-full px-3 py-2.5 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.bodyText.length}/1024</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Footer (opsional)</label>
              <input
                type="text"
                value={form.footerText}
                onChange={e => setForm(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="Contoh: Reply STOP untuk berhenti menerima pesan"
                maxLength={60}
                className="w-full px-3 py-2.5 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">Tombol (opsional, maks 3)</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addButton('QUICK_REPLY')} className="text-xs px-2.5 py-1 border border-saas-border rounded-lg hover:bg-gray-50 font-medium">+ Quick Reply</button>
                  <button type="button" onClick={() => addButton('URL')} className="text-xs px-2.5 py-1 border border-saas-border rounded-lg hover:bg-gray-50 font-medium">+ Link URL</button>
                </div>
              </div>
              {form.buttons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded whitespace-nowrap">{btn.type === 'QUICK_REPLY' ? 'Quick Reply' : 'URL'}</span>
                  <input
                    type="text"
                    value={btn.text}
                    onChange={e => updateButton(i, 'text', e.target.value)}
                    placeholder="Teks tombol"
                    maxLength={25}
                    className="flex-1 px-3 py-2 border-2 border-saas-border rounded-xl text-sm focus:border-saas-primary-blue focus:outline-none"
                  />
                  {btn.type === 'URL' && (
                    <input
                      type="url"
                      value={btn.url}
                      onChange={e => updateButton(i, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 border-2 border-saas-border rounded-xl text-sm focus:border-saas-primary-blue focus:outline-none"
                    />
                  )}
                  <button type="button" onClick={() => removeButton(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>Penting:</strong> Template yang disubmit akan diulas oleh Meta dalam 24–48 jam. Template baru bisa digunakan untuk broadcast hanya setelah status berubah menjadi <strong>Approved</strong>. Meta bisa menolak template yang melanggar kebijakan mereka.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting ke Meta...' : 'Submit untuk Disetujui Meta'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); setError(null); }}
                className="px-6 py-3 border-2 border-saas-border rounded-xl font-semibold text-sm hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-saas-border p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-bold text-saas-text-primary mb-2">Belum ada template</h3>
          <p className="text-gray-500 text-sm mb-6">Buat template pertama dan submit ke Meta untuk digunakan pada broadcast.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white rounded-xl font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            Buat Template Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(template => {
            const cfg = statusCfg(template.status);
            const buttons = template.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];
            return (
              <div key={template.id} className="bg-white rounded-2xl border border-saas-border p-5 hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <span className="font-bold text-saas-text-primary font-mono text-sm">{template.name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{template.category}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{template.language}</span>
                    </div>

                    {getComponentText(template, 'HEADER') && (
                      <p className="text-sm font-semibold text-gray-800 mb-1">{getComponentText(template, 'HEADER')}</p>
                    )}

                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{getComponentText(template, 'BODY')}</p>

                    {getComponentText(template, 'FOOTER') && (
                      <p className="text-xs text-gray-400 mt-2 italic">{getComponentText(template, 'FOOTER')}</p>
                    )}

                    {buttons.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {buttons.map((btn, i) => (
                          <span key={i} className="text-xs border border-blue-200 text-blue-600 px-3 py-1 rounded-lg font-medium">{btn.text}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => void handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
                    title="Hapus template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
