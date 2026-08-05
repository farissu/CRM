'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, Check, Info, Upload, Image as ImageIcon, Video as VideoIcon, FileText } from 'lucide-react';
import type { MessageTemplate, TemplateCategory } from '@/types';
import { templateApi, broadcastApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/templateConstants';

interface SendBroadcastWizardProps {
  draft: { name: string; label: string };
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'template' | 'audience' | 'schedule';
type AudienceType = 'SINGLE_NUMBER' | 'CSV' | 'CONDITION';

const STEPS: { key: Step; label: string }[] = [
  { key: 'template', label: 'Select Template' },
  { key: 'audience', label: 'Choose Audience' },
  { key: 'schedule', label: 'Set Schedule & Send' },
];

interface CsvSummary {
  rowCount: number;
  headers: string[];
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

function normalizePhoneInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly.startsWith('0') ? `62${digitsOnly.slice(1)}` : digitsOnly;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as { response?: { data?: { error?: string } } };
  return axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : fallback);
}

export default function SendBroadcastWizard({ draft, onBack, onSuccess }: SendBroadcastWizardProps) {
  const [step, setStep] = useState<Step>('template');
  const [broadcastName, setBroadcastName] = useState(draft.name);
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory>('MARKETING');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  const [audienceType, setAudienceType] = useState<AudienceType>('SINGLE_NUMBER');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [csvSeparator, setCsvSeparator] = useState<',' | ';'>(',');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (templateDropdownOpen) {
      templateDropdownRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [templateDropdownOpen]);

  const bodyVariableNumbers = useMemo(() => extractBodyVariableNumbers(selectedTemplate), [selectedTemplate]);

  const filteredTemplates = templates.filter(
    t => t.category === category && t.status === 'APPROVED' && t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const goNext = () => {
    setError(null);
    if (step === 'template' && !selectedTemplate) {
      setError('Please select a template');
      return;
    }
    if (step === 'audience') {
      if (audienceType === 'SINGLE_NUMBER' && !phoneNumber.trim()) {
        setError('Phone number is required');
        return;
      }
      if (audienceType === 'CSV' && !csvFile) {
        setError('Please upload a CSV file');
        return;
      }
      if (audienceType === 'CSV' && csvErrors.length > 0) {
        setError(csvErrors[0]);
        return;
      }
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
  };

  const goBack = () => {
    setError(null);
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.key);
    else onBack();
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCsvFile(file);
    setCsvSummary(null);
    setCsvErrors([]);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        setCsvErrors(['CSV file is empty']);
        return;
      }
      const headers = lines[0].split(csvSeparator).map(h => h.trim());
      if (!headers.includes('phone_number')) {
        setCsvErrors(['CSV is missing the required "phone_number" column']);
        return;
      }
      setCsvSummary({ rowCount: lines.length - 1, headers });
    };
    reader.readAsText(file);
  };

  const handleDownloadCsvTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      const blob = await broadcastApi.downloadCsvTemplate(selectedTemplate.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.name}_broadcast_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to download CSV template'));
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !testPhone.trim()) return;
    try {
      setTestSending(true);
      setTestError(null);
      const bodyParams = bodyVariableNumbers.map(n => variables[n] || `Sample ${n}`);
      await broadcastApi.sendTest({ templateId: selectedTemplate.id, to: testPhone.trim(), bodyParams });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (err: unknown) {
      setTestError(getErrorMessage(err, 'Failed to send test message'));
    } finally {
      setTestSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('name', broadcastName);
      if (draft.label) formData.append('label', draft.label);
      formData.append('templateId', selectedTemplate.id);
      formData.append('audienceType', audienceType);

      if (audienceType === 'SINGLE_NUMBER') {
        formData.append('phoneNumber', phoneNumber.trim());
        if (recipientName.trim()) formData.append('recipientName', recipientName.trim());
        formData.append('variables', JSON.stringify(variables));
      } else if (audienceType === 'CSV' && csvFile) {
        formData.append('csvFile', csvFile);
        formData.append('csvSeparator', csvSeparator);
      }

      if (scheduleMode === 'later' && scheduledAt) {
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
      }

      await broadcastApi.createBroadcast(formData);
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send broadcast'));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
  const audienceLabel = audienceType === 'SINGLE_NUMBER' ? 'Single Number' : audienceType === 'CSV' ? 'By CSV' : 'By Condition';
  const recipientCount = audienceType === 'SINGLE_NUMBER' ? (phoneNumber.trim() ? 1 : 0) : csvSummary?.rowCount ?? 0;

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#2d9c8f] font-semibold text-sm mb-4 hover:opacity-80 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
        Outbound Message List
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Send New Broadcast Message</h2>

      <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-between px-6 py-4 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i <= stepIndex ? 'bg-[#2d9c8f] text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </span>
              <span className={`text-sm font-semibold whitespace-nowrap ${i === stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
            {stepIndex === 0 ? 'Cancel' : 'Previous'}
          </button>
          {step !== 'schedule' ? (
            <button onClick={goNext} className="px-8 py-2 bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all">
              Next
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="px-8 py-2 bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold hover:bg-[#258577] disabled:opacity-50 transition-all"
            >
              {submitting ? 'Sending...' : scheduleMode === 'later' ? 'Schedule Broadcast' : 'Send Broadcast'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 font-medium">{error}</div>
      )}

      <div className="grid grid-cols-[1fr_260px] gap-6 items-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Broadcast Name</p>
              {editingName ? (
                <input
                  autoFocus
                  value={broadcastName}
                  onChange={e => setBroadcastName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  className="text-lg font-bold text-gray-900 border-b border-[#2d9c8f] focus:outline-none"
                />
              ) : (
                <p className="text-lg font-bold text-gray-900">{broadcastName}</p>
              )}
            </div>
            <button onClick={() => setEditingName(true)} className="text-[#2d9c8f] text-sm font-semibold hover:opacity-80 transition-opacity">
              Edit Name
            </button>
          </div>

          {step === 'template' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sender From</label>
                <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium text-sm">Sharing Happiness</div>
              </div>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Template Name</label>
                <button
                  type="button"
                  onClick={() => {
                    const opening = !templateDropdownOpen;
                    setTemplateDropdownOpen(opening);
                    if (opening) void loadTemplates();
                  }}
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
                    <div ref={templateDropdownRef} className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
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
                        <div className="px-4 py-3">
                          <p className="text-sm text-red-600 mb-1.5">{templatesError}</p>
                          <button type="button" onClick={() => void loadTemplates()} className="text-xs font-semibold text-[#2d9c8f] hover:opacity-80">
                            Retry
                          </button>
                        </div>
                      ) : (
                        <>
                          {filteredTemplates.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => { setSelectedTemplate(t); setVariables({}); setTemplateDropdownOpen(false); setTemplateSearch(''); }}
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
            </div>
          )}

          {step === 'audience' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Audience Type</label>
                <select
                  value={audienceType}
                  onChange={e => setAudienceType(e.target.value as AudienceType)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                >
                  <option value="SINGLE_NUMBER">Single Number</option>
                  <option value="CSV">By CSV</option>
                  <option value="CONDITION" disabled>By Condition (Coming soon)</option>
                </select>
              </div>

              {audienceType === 'SINGLE_NUMBER' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(normalizePhoneInput(e.target.value))}
                      placeholder="62812xxxxxxx"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recipient Name <span className="font-normal text-gray-400">Optional</span></label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Budi Santoso"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Shown as the contact name in Conversations instead of the phone number.</p>
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
                </div>
              )}

              {audienceType === 'CSV' && (
                <div className="space-y-4">
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#2d9c8f] mt-0.5" />Send a Broadcast Message from CSV (Max 100,000 customers)</p>
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#2d9c8f] mt-0.5" />Please use the correct CSV format. We recommend using Google Sheets for editing.</p>
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#2d9c8f] mt-0.5" />To send a broadcast message, please use the downloaded CSV file below. It has been designed according to your template structure.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadCsvTemplate()}
                    disabled={!selectedTemplate}
                    className="bg-[#2d9c8f] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#258577] disabled:opacity-50 transition-all"
                  >
                    Download CSV Template
                  </button>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type of Separator CSV File</label>
                    <select
                      value={csvSeparator}
                      onChange={e => setCsvSeparator(e.target.value as ',' | ';')}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                    >
                      <option value=",">Comma ( , )</option>
                      <option value=";">Semicolon ( ; )</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload CSV File</label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#2d9c8f]/40 rounded-lg py-8 cursor-pointer hover:bg-[#f0faf9] transition-colors">
                      <Upload className="w-5 h-5 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Drag and Drop file here or <span className="text-[#2d9c8f] font-semibold">Choose File</span></span>
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">Supported File: CSV</p>
                  </div>

                  {csvFile && (
                    <div className="border border-gray-200 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-gray-700">{csvFile.name}</p>
                      {csvSummary && <p className="text-xs text-gray-500 mt-1">{csvSummary.rowCount} recipients detected</p>}
                      {csvErrors.length > 0 && <p className="text-xs text-red-600 mt-1">{csvErrors[0]}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'schedule' && (
            <div className="space-y-5">
              <div className="flex gap-3">
                <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${scheduleMode === 'now' ? 'border-[#2d9c8f] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} className="accent-[#2d9c8f]" />
                    <span className="font-semibold text-sm text-gray-800">Send Now</span>
                  </div>
                  <p className="text-xs text-gray-500">Broadcast will be sent immediately after you confirm.</p>
                </label>
                <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${scheduleMode === 'later' ? 'border-[#2d9c8f] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} className="accent-[#2d9c8f]" />
                    <span className="font-semibold text-sm text-gray-800">Schedule for later</span>
                  </div>
                  <p className="text-xs text-gray-500">Pick a date and time to send this broadcast automatically.</p>
                </label>
              </div>

              {scheduleMode === 'later' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Send Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={nowLocal}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                  />
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                {[
                  ['Template', selectedTemplate?.name ?? '-'],
                  ['Category', selectedTemplate ? categoryLabel : '-'],
                  ['Audience Type', audienceLabel],
                  ['Recipients', String(recipientCount)],
                ].map(([k, v]) => (
                  <div key={k} className="flex border-b border-gray-100 last:border-0">
                    <div className="px-4 py-3 text-gray-500 w-44 shrink-0">{k}</div>
                    <div className="px-4 py-3 font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 sticky top-0">
          <div className="bg-[#e8f5f3] border border-[#2d9c8f]/30 rounded-xl p-4 flex items-center justify-between">
            <p className="font-bold text-gray-800 text-sm">Try Your Broadcast</p>
            <button
              onClick={() => setShowTestPanel(v => !v)}
              className="text-xs font-semibold text-[#2d9c8f] border border-[#2d9c8f] rounded-full px-3 py-1 hover:bg-white transition-colors"
            >
              Test Broadcast
            </button>
          </div>

          {showTestPanel && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <input
                type="tel"
                inputMode="numeric"
                value={testPhone}
                onChange={e => setTestPhone(normalizePhoneInput(e.target.value))}
                placeholder="62812xxxxxxx"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none"
              />
              <button
                onClick={() => void handleSendTest()}
                disabled={!selectedTemplate || !testPhone.trim() || testSending}
                className="w-full bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold py-2 disabled:opacity-50 transition-all"
              >
                {testSending ? 'Sending...' : 'Send Test'}
              </button>
              {testError && <p className="text-xs text-red-600">{testError}</p>}
              {testSent && <p className="text-xs text-green-600">Test message sent!</p>}
            </div>
          )}

          <div className="bg-[#ede7dc] rounded-xl p-4">
            <p className="font-bold text-gray-800 mb-3">Preview</p>
            <div className="bg-white rounded-xl shadow-sm p-4 min-h-[80px]">
              {selectedTemplate ? (
                <>
                  {(() => {
                    const header = selectedTemplate.components.find(c => c.type === 'HEADER');
                    const body = selectedTemplate.components.find(c => c.type === 'BODY');
                    const footer = selectedTemplate.components.find(c => c.type === 'FOOTER');
                    const buttons = selectedTemplate.components.find(c => c.type === 'BUTTONS');
                    const headerMediaUrl =
                      header?.format && header.format !== 'TEXT' ? header.example?.header_handle?.[0] : undefined;
                    const isResolvableMediaUrl = Boolean(headerMediaUrl?.startsWith('http'));
                    return (
                      <>
                        {header?.format && header.format !== 'TEXT' && (
                          <div className="mb-2">
                            {isResolvableMediaUrl && header.format === 'IMAGE' && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={headerMediaUrl} alt="" className="w-full rounded-lg max-h-40 object-cover" />
                            )}
                            {isResolvableMediaUrl && header.format === 'VIDEO' && (
                              <video src={headerMediaUrl} className="w-full rounded-lg max-h-40" controls />
                            )}
                            {(!isResolvableMediaUrl || header.format === 'DOCUMENT') && (
                              <div className="flex items-center justify-center bg-gray-100 rounded-lg h-24 text-gray-300">
                                {header.format === 'IMAGE' && <ImageIcon className="w-6 h-6" />}
                                {header.format === 'VIDEO' && <VideoIcon className="w-6 h-6" />}
                                {header.format === 'DOCUMENT' && <FileText className="w-6 h-6" />}
                              </div>
                            )}
                          </div>
                        )}
                        {header?.format === 'TEXT' && header.text && <p className="font-bold text-gray-900 text-sm mb-1">{header.text}</p>}
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {body?.text ? substituteVariables(body.text, variables) : ''}
                        </p>
                        {footer?.text && <p className="text-xs text-gray-400 mt-2">{footer.text}</p>}
                        {buttons?.buttons && buttons.buttons.length > 0 && (
                          <div className="border-t border-gray-100 mt-3 pt-2 space-y-1.5">
                            {buttons.buttons.map((b, i) => (
                              <div key={i} className="text-center text-sm text-[#0093E9] font-medium">{b.text}</div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <p className="text-right text-xs text-gray-400 mt-2">5:09 AM</p>
                </>
              ) : (
                <p className="text-sm text-gray-300">Select a template to preview</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
