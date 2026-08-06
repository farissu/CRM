import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronDown, Check, Send, CheckCircle2 } from 'lucide-react';
import type { Contact, MessageTemplate, TemplateCategory } from '@/types';
import { templateApi, broadcastApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/templateConstants';

interface SendTemplateModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

function extractBodyVariableNumbers(template: MessageTemplate | null): string[] {
  if (!template) return [];
  const body = template.components.find(c => c.type === 'BODY');
  const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
  return Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))).sort((a, b) => Number(a) - Number(b));
}

function substituteVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n: string) => variables[n] || `{{${n}}}`);
}

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string } } };
  return axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : fallback);
}

export default function SendTemplateModal({ contact, isOpen, onClose, onSent }: SendTemplateModalProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory>('MARKETING');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const bodyVariableNumbers = useMemo(() => extractBodyVariableNumbers(selectedTemplate), [selectedTemplate]);

  const filteredTemplates = templates.filter(
    t => t.category === category && t.status === 'APPROVED' && t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTemplate(null);
    setVariables({});
    setError(null);
    setSent(false);
    setTemplateSearch('');

    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true);
        setTemplatesError(null);
        const res = await templateApi.getTemplates();
        setTemplates(res.templates);
      } catch (err: unknown) {
        setTemplatesError(getErrorMessage(err, 'Failed to load templates'));
      } finally {
        setTemplatesLoading(false);
      }
    };
    void loadTemplates();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('name', `Quick message to ${contact.name || contact.phoneNumber}`);
      formData.append('templateId', selectedTemplate.id);
      formData.append('audienceType', 'SINGLE_NUMBER');
      formData.append('phoneNumber', contact.phoneNumber);
      if (contact.name) formData.append('recipientName', contact.name);
      formData.append('variables', JSON.stringify(variables));

      await broadcastApi.createBroadcast(formData);
      setSent(true);
      onSent();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
    } finally {
      setSubmitting(false);
    }
  };

  const bodyComponent = selectedTemplate?.components.find(c => c.type === 'BODY');

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-soft max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-bold">Send Template Message</h2>
              <p className="text-sm text-white/80">{contact.name || contact.phoneNumber}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all duration-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {sent ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#e8f5f3] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-[#2d9c8f]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">Message Sent</h3>
              <p className="text-sm text-gray-500 mb-6">Your template message is on its way to {contact.name || contact.phoneNumber}.</p>
              <button
                onClick={onClose}
                className="w-full px-6 py-2.5 bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-medium">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Template Category</label>
                  <select
                    value={category}
                    onChange={e => { setCategory(e.target.value as TemplateCategory); setSelectedTemplate(null); }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Template</label>
                  <button
                    type="button"
                    onClick={() => setTemplateDropdownOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none"
                  >
                    <span className={selectedTemplate ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                      {selectedTemplate ? selectedTemplate.name : 'Select a template'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {templateDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setTemplateDropdownOpen(false)} />
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        <div className="p-2 sticky top-0 bg-white border-b border-gray-100">
                          <input
                            autoFocus
                            value={templateSearch}
                            onChange={e => setTemplateSearch(e.target.value)}
                            placeholder="Search template name"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none"
                          />
                        </div>
                        {templatesLoading ? (
                          <p className="px-4 py-3 text-sm text-gray-400">Loading templates...</p>
                        ) : templatesError ? (
                          <p className="px-4 py-3 text-sm text-red-600">{templatesError}</p>
                        ) : (
                          <>
                            {filteredTemplates.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => { setSelectedTemplate(t); setVariables({}); setTemplateDropdownOpen(false); setTemplateSearch(''); setError(null); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                              >
                                {t.name}
                                {selectedTemplate?.id === t.id && <Check className="w-4 h-4 text-[#2d9c8f]" />}
                              </button>
                            ))}
                            {filteredTemplates.length === 0 && (
                              <p className="px-4 py-3 text-sm text-gray-400">No approved templates in this category</p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {bodyVariableNumbers.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Variable values</h4>
                    <div className="space-y-2">
                      {bodyVariableNumbers.map(n => (
                        <div key={n}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{`{{${n}}}`}</label>
                          <input
                            type="text"
                            value={variables[n] ?? ''}
                            onChange={e => setVariables(p => ({ ...p, [n]: e.target.value }))}
                            placeholder={`Value for {{${n}}}`}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTemplate && bodyComponent?.text && (
                  <div className="bg-[#ede7dc] rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-500 mb-2">Preview</p>
                    <div className="bg-white rounded-xl shadow-sm p-3">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{substituteVariables(bodyComponent.text, variables)}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-saas-border bg-gray-50 shrink-0">
                <button
                  onClick={() => void handleSend()}
                  disabled={!selectedTemplate || submitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#2d9c8f] text-white px-5 py-3 rounded-xl font-semibold hover:bg-[#258577] disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
