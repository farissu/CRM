'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onNext: (draft: { name: string; label: string }) => void;
}

const MAX_LENGTH = 100;

export default function CreateBroadcastModal({ isOpen, onCancel, onNext }: CreateBroadcastModalProps) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setLabel('');
    onCancel();
  };

  const handleNext = () => {
    if (!name.trim()) return;
    onNext({ name: name.trim(), label: label.trim() });
    setName('');
    setLabel('');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-soft max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">Create Broadcast Message</h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Broadcast Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, MAX_LENGTH))}
                  placeholder="Type your broadcast name"
                  className="w-full px-4 py-3 pr-14 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                />
                <span className="absolute right-3 bottom-2.5 text-xs text-gray-400">{name.length}/{MAX_LENGTH}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Broadcast Label (Optional)</label>
              <div className="relative">
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value.slice(0, MAX_LENGTH))}
                  placeholder="Type your broadcast label"
                  className="w-full px-4 py-3 pr-14 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                />
                <span className="absolute right-3 bottom-2.5 text-xs text-gray-400">{label.length}/{MAX_LENGTH}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="px-8 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2d9c8f] hover:bg-[#258577] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
