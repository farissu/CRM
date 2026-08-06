import React, { useState, useEffect } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import type { Label } from '@/types';
import { labelApi } from '@/lib/api';
import { PREDEFINED_COLORS } from '../settingsUtils';
import ConfirmDialog from '../../chat/ConfirmDialog';

export default function LabelsTab() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<Label | null>(null);

  useEffect(() => {
    void loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await labelApi.getLabels();
      setLabels(response.labels);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const response = await labelApi.createLabel({ name: newLabelName.trim(), color: newLabelColor });
      setLabels([...labels, response.label]);
      setNewLabelName('');
      setNewLabelColor('#3B82F6');
      setIsAdding(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create label';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await labelApi.deleteLabel(id);
      setLabels(labels.filter(label => label.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete label';
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? msg);
    } finally {
      setLoading(false);
      setLabelToDelete(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-saas-text-primary">Contact Labels</h2>
          <p className="text-gray-600 mt-1">Create and manage labels to organize your contacts</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-soft-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Label
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

      {isAdding && (
        <div className="bg-white border-2 border-saas-primary-blue rounded-2xl p-6 mb-6 shadow-soft">
          <h3 className="text-lg font-bold text-saas-text-primary mb-4">New Label</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Label Name</label>
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="e.g., VIP, Priority, Follow Up"
                className="w-full px-4 py-3 border-2 border-saas-border rounded-xl focus:border-saas-primary-blue focus:outline-none transition-all duration-200 font-medium"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
              <div className="flex gap-3">
                {PREDEFINED_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    className={`w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110 ${
                      newLabelColor === color ? 'ring-4 ring-offset-2 ring-saas-primary-blue' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => void handleAddLabel()}
                disabled={!newLabelName.trim() || loading}
                className="flex-1 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? 'Creating...' : 'Create Label'}
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewLabelName(''); setNewLabelColor('#3B82F6'); }}
                className="px-5 py-3 border-2 border-saas-border rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {labels.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-saas-border">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No labels yet</p>
            <p className="text-gray-500 text-sm mt-1">Create your first label to get started</p>
          </div>
        ) : (
          labels.map((label) => (
            <div
              key={label.id}
              className="bg-white rounded-2xl p-4 flex items-center justify-between hover:shadow-soft transition-all duration-200 border border-saas-border"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-soft-sm"
                  style={{ backgroundColor: label.color }}
                >
                  <Tag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-saas-text-primary">{label.name}</h3>
                  <p className="text-sm text-gray-500">{label.color}</p>
                </div>
              </div>
              <button
                onClick={() => setLabelToDelete(label)}
                className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-red-500 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={labelToDelete !== null}
        title="Hapus Label"
        message={`Yakin ingin menghapus label "${labelToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={() => labelToDelete && void handleDeleteLabel(labelToDelete.id)}
        onCancel={() => setLabelToDelete(null)}
      />
    </div>
  );
}
