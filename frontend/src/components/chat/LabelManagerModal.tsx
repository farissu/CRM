import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';
import type { Label, Contact } from '@/types';
import { labelApi } from '@/lib/api';

interface LabelManagerModalProps {
  contact: Contact;
  onClose: () => void;
  onUpdate: (updatedContact: Contact) => void;
}

export default function LabelManagerModal({ contact, onClose, onUpdate }: LabelManagerModalProps) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignedLabelIds, setAssignedLabelIds] = useState<Set<string>>(
    new Set(contact.labels?.map(l => l.id) || [])
  );

  useEffect(() => {
    loadLabels();
  }, []);

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

  const handleToggleLabel = async (label: Label) => {
    const isAssigned = assignedLabelIds.has(label.id);
    
    try {
      setLoading(true);
      
      if (isAssigned) {
        // Remove label
        await labelApi.removeLabel(contact.id, label.id);
        setAssignedLabelIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(label.id);
          return newSet;
        });
        
        // Update contact
        const updatedLabels = contact.labels?.filter(l => l.id !== label.id) || [];
        onUpdate({ ...contact, labels: updatedLabels });
      } else {
        // Assign label
        await labelApi.assignLabel(contact.id, label.id);
        setAssignedLabelIds(prev => new Set(prev).add(label.id));
        
        // Update contact
        const updatedLabels = [...(contact.labels || []), label];
        onUpdate({ ...contact, labels: updatedLabels });
      }
    } catch (error) {
      console.error('Failed to toggle label:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-soft max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-saas-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-saas-text-primary">Manage Labels</h2>
              <p className="text-sm text-gray-500">{contact.name || contact.phoneNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && allLabels.length === 0 ? (
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
                const isAssigned = assignedLabelIds.has(label.id);
                
                return (
                  <button
                    key={label.id}
                    onClick={() => handleToggleLabel(label)}
                    disabled={loading}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 ${
                      isAssigned
                        ? 'border-saas-primary-blue bg-saas-primary-blue/5'
                        : 'border-saas-border hover:border-saas-primary-blue/50 hover:bg-gray-50'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                      <div className="w-8 h-8 bg-saas-primary-blue rounded-xl flex items-center justify-center">
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
        <div className="p-6 border-t border-saas-border">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white px-5 py-3 rounded-xl font-semibold hover:scale-102 transition-all duration-200 shadow-soft-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
