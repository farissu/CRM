import React, { useState, useEffect } from 'react';
import { X, Tag, Check } from 'lucide-react';
import type { Label, Contact } from '@/types';
import { labelApi } from '@/lib/api';

interface ManageLabelsModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onLabelsUpdated: () => void;
}

export default function ManageLabelsModal({
  contact,
  isOpen,
  onClose,
  onLabelsUpdated,
}: ManageLabelsModalProps) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [contactLabelIds, setContactLabelIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLabels();
      // Initialize contact label IDs
      if (contact.labels) {
        setContactLabelIds(new Set(contact.labels.map(label => label.id)));
      }
    }
  }, [isOpen, contact]);

  const loadLabels = async () => {
    try {
      setLoading(true);
      const response = await labelApi.getLabels();
      setAllLabels(response.labels);
    } catch (error) {
      console.error('Failed to load labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = async (labelId: string) => {
    try {
      setUpdating(true);
      const hasLabel = contactLabelIds.has(labelId);

      if (hasLabel) {
        await labelApi.removeLabelFromContact(contact.id, labelId);
        setContactLabelIds(prev => {
          const next = new Set(prev);
          next.delete(labelId);
          return next;
        });
      } else {
        await labelApi.assignLabelToContact(contact.id, labelId);
        setContactLabelIds(prev => new Set(prev).add(labelId));
      }

      onLabelsUpdated();
    } catch (error) {
      console.error('Failed to toggle label:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-soft max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Manage Labels</h2>
                <p className="text-sm text-white/80">{contact.name || contact.phoneNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-saas-primary-blue border-t-transparent"></div>
              </div>
            ) : allLabels.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No labels available</p>
                <p className="text-gray-500 text-sm mt-1">Create labels in Settings first</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allLabels.map((label) => {
                  const isAssigned = contactLabelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      disabled={updating}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 border-2 ${
                        isAssigned
                          ? 'border-saas-primary-blue bg-saas-primary-blue/5 hover:bg-saas-primary-blue/10'
                          : 'border-saas-border hover:border-saas-primary-blue/50 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-soft-sm"
                          style={{ backgroundColor: label.color }}
                        >
                          <Tag className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-saas-text-primary">{label.name}</p>
                          <p className="text-xs text-gray-500">{label.color}</p>
                        </div>
                      </div>
                      {isAssigned && (
                        <div className="w-8 h-8 rounded-full bg-saas-primary-blue flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-saas-border bg-gray-50">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
