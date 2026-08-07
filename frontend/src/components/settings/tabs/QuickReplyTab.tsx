import React, { useState, useEffect } from 'react';
import { Plus, X, Pencil, MessageSquareText } from 'lucide-react';
import type { QuickReply } from '@/types';
import { quickReplyApi } from '@/lib/api';
import ConfirmDialog from '../../chat/ConfirmDialog';

interface QuickReplyFormState {
  id: string | null;
  title: string;
  text: string;
  isActive: boolean;
}

const EMPTY_FORM: QuickReplyFormState = { id: null, title: '', text: '', isActive: true };

export default function QuickReplyTab() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [form, setForm] = useState<QuickReplyFormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickReplyToDelete, setQuickReplyToDelete] = useState<QuickReply | null>(null);

  useEffect(() => {
    void loadQuickReplies();
  }, []);

  const loadQuickReplies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await quickReplyApi.getQuickReplies();
      setQuickReplies(response.quickReplies);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quick replies');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? (err instanceof Error ? err.message : fallback);

  const handleSave = async () => {
    if (!form.title.trim() || !form.text.trim()) return;
    try {
      setLoading(true);
      setError(null);
      if (form.id) {
        const response = await quickReplyApi.updateQuickReply(form.id, {
          title: form.title.trim(),
          text: form.text.trim(),
          isActive: form.isActive,
        });
        setQuickReplies(prev => prev.map(qr => qr.id === form.id ? response.quickReply : qr));
      } else {
        const response = await quickReplyApi.createQuickReply({
          title: form.title.trim(),
          text: form.text.trim(),
          isActive: form.isActive,
        });
        setQuickReplies(prev => [...prev, response.quickReply]);
      }
      setForm(EMPTY_FORM);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save quick reply'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (quickReply: QuickReply) => {
    try {
      setError(null);
      const response = await quickReplyApi.updateQuickReply(quickReply.id, { isActive: !quickReply.isActive });
      setQuickReplies(prev => prev.map(qr => qr.id === quickReply.id ? response.quickReply : qr));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await quickReplyApi.deleteQuickReply(id);
      setQuickReplies(prev => prev.filter(qr => qr.id !== id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete quick reply'));
    } finally {
      setLoading(false);
      setQuickReplyToDelete(null);
    }
  };

  const startEdit = (quickReply: QuickReply) => {
    setForm({ id: quickReply.id, title: quickReply.title, text: quickReply.text, isActive: quickReply.isActive });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-saas-text-primary">Quick Reply</h2>
          <p className="text-gray-600 mt-1">Buat balasan cepat yang bisa langsung dipilih saat membalas percakapan</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => { setForm(EMPTY_FORM); setIsEditing(true); }}
            className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-soft-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Quick Reply
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isEditing && (
        <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">{form.id ? 'Edit Quick Reply' : 'New Quick Reply'}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Salam Pembuka, Info Rekening"
                className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Ini yang akan ditampilkan di tombol pilihan Quick Reply</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Text</label>
              <textarea
                value={form.text}
                onChange={(e) => setForm(p => ({ ...p, text: e.target.value }))}
                placeholder="Isi pesan yang akan masuk ke kolom chat"
                rows={4}
                className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium resize-none"
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm(p => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 accent-saas-primary-blue"
              />
              <span className="text-sm font-semibold text-gray-700">Active</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => void handleSave()}
                disabled={!form.title.trim() || !form.text.trim() || loading}
                className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? 'Saving...' : form.id ? 'Save Changes' : 'Create Quick Reply'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {quickReplies.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
            <MessageSquareText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Belum ada quick reply</p>
            <p className="text-gray-500 text-sm mt-1">Buat quick reply pertamamu untuk mempercepat balasan</p>
          </div>
        ) : (
          quickReplies.map((quickReply) => (
            <div
              key={quickReply.id}
              className="bg-white rounded-2xl p-4 flex items-start justify-between gap-4 hover:shadow-soft transition-all duration-200 border border-saas-border"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-saas-bg flex items-center justify-center shadow-soft-sm shrink-0">
                  <MessageSquareText className="w-6 h-6 text-saas-primary-blue" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-saas-text-primary">{quickReply.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{quickReply.text}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleToggleActive(quickReply)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    quickReply.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {quickReply.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => startEdit(quickReply)}
                  className="p-2 hover:bg-blue-50 rounded-xl transition-all duration-200 text-saas-primary-blue"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setQuickReplyToDelete(quickReply)}
                  className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-red-500 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={quickReplyToDelete !== null}
        title="Hapus Quick Reply"
        message={`Yakin ingin menghapus quick reply "${quickReplyToDelete?.title}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={() => quickReplyToDelete && void handleDelete(quickReplyToDelete.id)}
        onCancel={() => setQuickReplyToDelete(null)}
      />
    </div>
  );
}
