'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { ChevronLeft, ChevronDown, Check, Info, Upload, CheckCircle2, X } from 'lucide-react';
import type { MessageTemplate, TemplateCategory } from '@/types';
import { templateApi, broadcastApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/templateConstants';
import TemplateMessagePreview from './TemplateMessagePreview';

interface SendBroadcastWizardProps {
  draft: { name: string; label: string };
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'template' | 'audience' | 'schedule';
type AudienceType = 'SINGLE_NUMBER' | 'CSV';

const STEPS: { key: Step; label: string }[] = [
  { key: 'template', label: 'Select Template' },
  { key: 'audience', label: 'Choose Audience' },
  { key: 'schedule', label: 'Set Schedule & Send' },
];

const EXCEL_PREVIEW_ROW_LIMIT = 10;

interface ExcelPreviewRow {
  cells: string[];
  missingPhone: boolean;
  hasEmptyVariable: boolean;
}

interface ExcelSummary {
  rowCount: number;
  headers: string[];
  previewRows: ExcelPreviewRow[];
  missingPhoneCount: number;
  emptyVariableCount: number;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) {
      return (value as { richText: Array<{ text: string }> }).richText.map(part => part.text).join('').trim();
    }
    if ('error' in value) return '';
    if ('text' in value) return String((value as { text: unknown }).text ?? '').trim();
    if ('result' in value) return String((value as { result: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function extractBodyVariableNumbers(template: MessageTemplate | null): string[] {
  if (!template) return [];
  const body = template.components.find(c => c.type === 'BODY');
  const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
  return Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))).sort((a, b) => Number(a) - Number(b));
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
  const [submitResult, setSubmitResult] = useState<'sent' | 'scheduled' | null>(null);

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
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ExcelSummary | null>(null);
  const [excelErrors, setExcelErrors] = useState<string[]>([]);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const excelProcessingIdRef = useRef(0);

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
      if (audienceType === 'CSV' && !excelFile) {
        setError('Please upload an Excel file');
        return;
      }
      if (audienceType === 'CSV' && excelErrors.length > 0) {
        setError(excelErrors[0]);
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

  const processExcelFile = async (file: File) => {
    const processingId = ++excelProcessingIdRef.current;
    setExcelFile(file);
    setExcelSummary(null);
    setExcelErrors([]);

    const isStale = () => excelProcessingIdRef.current !== processingId;

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      if (isStale()) return;

      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount === 0) {
        setExcelErrors(['Excel file is empty']);
        return;
      }

      const headers: string[] = [];
      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cellToString(cell.value);
      });
      if (!headers.includes('phone_number')) {
        setExcelErrors(['Excel file is missing the required "phone_number" column']);
        return;
      }

      const phoneIndex = headers.indexOf('phone_number');
      const variableIndexes = bodyVariableNumbers.map(n => headers.indexOf(`var${n}`));

      let missingPhoneCount = 0;
      let emptyVariableCount = 0;
      let rowCount = 0;
      const previewRows: ExcelPreviewRow[] = [];

      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        if (row.actualCellCount === 0) continue;

        const cells = headers.map((_, colIdx) => cellToString(row.getCell(colIdx + 1).value));
        const missingPhone = !cells[phoneIndex];
        const hasEmptyVariable = variableIndexes.some(idx => idx === -1 || !cells[idx]);

        if (missingPhone) missingPhoneCount += 1;
        if (hasEmptyVariable) emptyVariableCount += 1;
        if (rowCount < EXCEL_PREVIEW_ROW_LIMIT) previewRows.push({ cells, missingPhone, hasEmptyVariable });
        rowCount += 1;
      }

      if (isStale()) return;
      setExcelSummary({ rowCount, headers, previewRows, missingPhoneCount, emptyVariableCount });
    } catch {
      if (isStale()) return;
      setExcelErrors(['File is not a valid Excel (.xlsx) file']);
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processExcelFile(file);
  };

  const handleExcelDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(true);
  };

  const handleExcelDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
  };

  const handleExcelDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processExcelFile(file);
  };

  const handleClearExcelFile = () => {
    excelProcessingIdRef.current += 1;
    setExcelFile(null);
    setExcelSummary(null);
    setExcelErrors([]);
  };

  const handleDownloadExcelTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      const blob = await broadcastApi.downloadExcelTemplate(selectedTemplate.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.name}_broadcast_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to download Excel template'));
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
      } else if (audienceType === 'CSV' && excelFile) {
        formData.append('excelFile', excelFile);
      }

      if (scheduleMode === 'later' && scheduledAt) {
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
      }

      await broadcastApi.createBroadcast(formData);
      setSubmitResult(scheduleMode === 'later' ? 'scheduled' : 'sent');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send broadcast'));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
  const audienceLabel = audienceType === 'SINGLE_NUMBER' ? 'Single Number' : 'By Excel File';
  const recipientCount = audienceType === 'SINGLE_NUMBER' ? (phoneNumber.trim() ? 1 : 0) : excelSummary?.rowCount ?? 0;

  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-sm mb-4 hover:opacity-80 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
        Outbound Message List
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Send New Broadcast Message</h2>

      <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-between px-6 py-4 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i <= stepIndex ? 'bg-[#597ea3] text-white' : 'bg-gray-100 text-gray-400'}`}>
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
            <button onClick={goNext} className="px-8 py-2 bg-[#597ea3] text-white rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all">
              Next
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="px-8 py-2 bg-[#597ea3] text-white rounded-lg text-sm font-semibold hover:bg-[#416180] disabled:opacity-50 transition-all"
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
                  className="text-lg font-bold text-gray-900 border-b border-[#597ea3] focus:outline-none"
                />
              ) : (
                <p className="text-lg font-bold text-gray-900">{broadcastName}</p>
              )}
            </div>
            <button onClick={() => setEditingName(true)} className="text-[#597ea3] text-sm font-semibold hover:opacity-80 transition-opacity">
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
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
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none"
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none"
                        />
                      </div>
                      {templatesLoading ? (
                        <p className="px-4 py-3 text-sm text-gray-400">Loading templates...</p>
                      ) : templatesError ? (
                        <div className="px-4 py-3">
                          <p className="text-sm text-red-600 mb-1.5">{templatesError}</p>
                          <button type="button" onClick={() => void loadTemplates()} className="text-xs font-semibold text-[#597ea3] hover:opacity-80">
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
                              {selectedTemplate?.id === t.id && <Check className="w-4 h-4 text-[#597ea3]" />}
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                >
                  <option value="SINGLE_NUMBER">Single Number</option>
                  <option value="CSV">By Excel File</option>
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recipient Name <span className="font-normal text-gray-400">Optional</span></label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Budi Santoso"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
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
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
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
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#597ea3] mt-0.5" />Send a Broadcast Message from an Excel file (Max 100,000 customers)</p>
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#597ea3] mt-0.5" />Enter each recipient in its own row and column — do not paste a whole comma-separated line into a single cell.</p>
                    <p className="flex gap-2 items-start"><Info className="w-4 h-4 shrink-0 text-[#597ea3] mt-0.5" />To send a broadcast message, please use the downloaded Excel file below. It has been designed according to your template structure.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadExcelTemplate()}
                    disabled={!selectedTemplate}
                    className="bg-[#597ea3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#416180] disabled:opacity-50 transition-all"
                  >
                    Download Excel Template
                  </button>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Excel File</label>
                    <label
                      onDragOver={handleExcelDragOver}
                      onDragLeave={handleExcelDragLeave}
                      onDrop={handleExcelDrop}
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${
                        isDraggingExcel ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-[#597ea3]/40 hover:bg-[#f0faf9]'
                      }`}
                    >
                      <Upload className="w-5 h-5 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Drag and Drop file here or <span className="text-[#597ea3] font-semibold">Choose File</span></span>
                      <input type="file" accept=".xlsx" className="hidden" onChange={handleExcelFileChange} />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">Supported File: XLSX (.xlsx)</p>
                  </div>

                  {excelFile && (
                    <div className="border border-gray-200 rounded-lg p-3 text-sm flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-700">{excelFile.name}</p>
                        {excelSummary && <p className="text-xs text-gray-500 mt-1">{excelSummary.rowCount} recipients detected</p>}
                        {excelErrors.length > 0 && <p className="text-xs text-red-600 mt-1">{excelErrors[0]}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={handleClearExcelFile}
                        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Cancel Excel file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {excelSummary && excelSummary.previewRows.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-sm font-semibold text-gray-700">Preview</label>
                        {(excelSummary.missingPhoneCount > 0 || excelSummary.emptyVariableCount > 0) && (
                          <span className="text-xs font-semibold text-red-600">
                            {excelSummary.missingPhoneCount > 0 && `${excelSummary.missingPhoneCount} missing phone_number`}
                            {excelSummary.missingPhoneCount > 0 && excelSummary.emptyVariableCount > 0 && ' · '}
                            {excelSummary.emptyVariableCount > 0 && `${excelSummary.emptyVariableCount} row(s) with empty variable`}
                          </span>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">#</th>
                              {excelSummary.headers.map(h => (
                                <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {excelSummary.previewRows.map((row, i) => {
                              const hasIssue = row.missingPhone || row.hasEmptyVariable;
                              return (
                                <tr key={i} className={hasIssue ? 'bg-red-50' : undefined}>
                                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                  {excelSummary.headers.map((h, colIdx) => (
                                    <td key={h} className={`px-3 py-2 whitespace-nowrap ${!row.cells[colIdx] ? 'text-red-500 italic' : 'text-gray-700'}`}>
                                      {row.cells[colIdx] || 'empty'}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {excelSummary.rowCount > EXCEL_PREVIEW_ROW_LIMIT && (
                        <p className="text-xs text-gray-400 mt-1">
                          Showing first {EXCEL_PREVIEW_ROW_LIMIT} of {excelSummary.rowCount} recipients
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'schedule' && (
            <div className="space-y-5">
              <div className="flex gap-3">
                <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${scheduleMode === 'now' ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} className="accent-[#597ea3]" />
                    <span className="font-semibold text-sm text-gray-800">Send Now</span>
                  </div>
                  <p className="text-xs text-gray-500">Broadcast will be sent immediately after you confirm.</p>
                </label>
                <label className={`flex-1 border rounded-lg p-4 cursor-pointer transition-all ${scheduleMode === 'later' ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} className="accent-[#597ea3]" />
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
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
          <div className="bg-[#eef6ff] border border-[#597ea3]/30 rounded-xl p-4 flex items-center justify-between">
            <p className="font-bold text-gray-800 text-sm">Try Your Broadcast</p>
            <button
              onClick={() => setShowTestPanel(v => !v)}
              className="text-xs font-semibold text-[#597ea3] border border-[#597ea3] rounded-full px-3 py-1 hover:bg-white transition-colors"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none"
              />
              <button
                onClick={() => void handleSendTest()}
                disabled={!selectedTemplate || !testPhone.trim() || testSending}
                className="w-full bg-[#597ea3] text-white rounded-lg text-sm font-semibold py-2 disabled:opacity-50 transition-all"
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
                <TemplateMessagePreview components={selectedTemplate.components} variables={variables} timestamp="5:09 AM" />
              ) : (
                <p className="text-sm text-gray-300">Select a template to preview</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {submitResult && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-soft max-w-sm w-full p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#eef6ff] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-[#597ea3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">
                {submitResult === 'scheduled' ? 'Broadcast Scheduled' : 'Broadcast Queued'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {submitResult === 'scheduled'
                  ? 'Your broadcast has been scheduled and will be sent automatically at the chosen time.'
                  : 'Your broadcast has been queued and is being sent now. Check the Outbound Message list to track its status.'}
              </p>
              <button
                onClick={onSuccess}
                className="w-full px-6 py-2.5 bg-[#597ea3] text-white rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
