'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Image as ImageIcon, Video as VideoIcon, FileText, X } from 'lucide-react';
import type { TemplateCategory, TemplateComponent } from '@/types';
import { templateApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/templateConstants';

interface CreateTemplateWizardProps {
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'basic' | 'header' | 'body' | 'footer' | 'buttons' | 'summary';

const STEPS: { key: Step; label: string }[] = [
  { key: 'basic', label: 'Template Info' },
  { key: 'header', label: 'Header' },
  { key: 'body', label: 'Body' },
  { key: 'footer', label: 'Footer' },
  { key: 'buttons', label: 'Buttons' },
  { key: 'summary', label: 'Summary' },
];

const LANGUAGES = [
  { value: 'id', label: 'Indonesian' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'en', label: 'English' },
];

type HeaderMediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

const HEADER_MEDIA_ACCEPT: Record<HeaderMediaType, string> = {
  IMAGE: 'image/jpeg,image/png',
  VIDEO: 'video/mp4,video/3gpp',
  DOCUMENT: 'application/pdf',
};

const HEADER_MEDIA_HINT: Record<HeaderMediaType, string> = {
  IMAGE: 'Choose JPG or PNG File',
  VIDEO: 'Choose MP4 or 3GP File',
  DOCUMENT: 'Choose PDF File',
};

const MEDIA_TYPES: { value: HeaderMediaType; label: string; icon: typeof ImageIcon }[] = [
  { value: 'IMAGE', label: 'Image', icon: ImageIcon },
  { value: 'VIDEO', label: 'Video', icon: VideoIcon },
  { value: 'DOCUMENT', label: 'Document', icon: FileText },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FormState {
  name: string;
  category: TemplateCategory;
  language: string;
  headerType: 'NONE' | 'TEXT' | 'MEDIA';
  headerText: string;
  headerMediaType: HeaderMediaType;
  headerMediaFile: File | null;
  headerMediaHandle: string | null;
  headerMediaPreviewUrl: string | null;
  bodyText: string;
  bodySamples: Record<string, string>;
  footerText: string;
  buttonType: 'NONE' | 'QUICK_REPLY' | 'CALL_TO_ACTION';
  buttons: Array<{ text: string; url?: string; phone?: string; actionType?: 'URL' | 'PHONE' }>;
}

const INIT: FormState = {
  name: '', category: 'MARKETING', language: 'id',
  headerType: 'NONE', headerText: '',
  headerMediaType: 'IMAGE', headerMediaFile: null, headerMediaHandle: null, headerMediaPreviewUrl: null,
  bodyText: '', bodySamples: {},
  footerText: '',
  buttonType: 'NONE', buttons: [],
};

export default function CreateTemplateWizard({ onBack, onSuccess }: CreateTemplateWizardProps) {
  const [step, setStep] = useState<Step>('basic');
  const [form, setForm] = useState<FormState>(INIT);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [headerMediaUploading, setHeaderMediaUploading] = useState(false);
  const [headerMediaError, setHeaderMediaError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (form.headerMediaPreviewUrl) URL.revokeObjectURL(form.headerMediaPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHeaderMediaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (form.headerMediaPreviewUrl) URL.revokeObjectURL(form.headerMediaPreviewUrl);
    const previewUrl = form.headerMediaType === 'IMAGE' || form.headerMediaType === 'VIDEO' ? URL.createObjectURL(file) : null;

    setHeaderMediaError(null);
    setForm(p => ({ ...p, headerMediaFile: file, headerMediaHandle: null, headerMediaPreviewUrl: previewUrl }));

    try {
      setHeaderMediaUploading(true);
      const res = await templateApi.uploadHeaderMedia(file);
      setForm(p => ({ ...p, headerMediaHandle: res.handle }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setHeaderMediaError(axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to upload media'));
      setForm(p => ({ ...p, headerMediaFile: null, headerMediaPreviewUrl: null }));
    } finally {
      setHeaderMediaUploading(false);
    }
  };

  const removeHeaderMedia = () => {
    if (form.headerMediaPreviewUrl) URL.revokeObjectURL(form.headerMediaPreviewUrl);
    setHeaderMediaError(null);
    setForm(p => ({ ...p, headerMediaFile: null, headerMediaHandle: null, headerMediaPreviewUrl: null }));
  };

  const bodyVariables = Array.from(
    new Set((form.bodyText.match(/\{\{(\d+)\}\}/g) ?? []).map(v => v.replace(/\{\{|\}\}/g, '')))
  ).sort((a, b) => Number(a) - Number(b));

  const insertVariable = () => {
    const textarea = bodyRef.current;
    const existing = (form.bodyText.match(/\{\{\d+\}\}/g) ?? []).length;
    const varNum = existing + 1;
    const varText = `{{${varNum}}}`;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = form.bodyText.slice(0, start) + varText + form.bodyText.slice(end);
      setForm(p => ({ ...p, bodyText: newText }));
      // Restore cursor after the inserted variable
      requestAnimationFrame(() => {
        textarea.selectionStart = start + varText.length;
        textarea.selectionEnd = start + varText.length;
        textarea.focus();
      });
    } else {
      setForm(p => ({ ...p, bodyText: p.bodyText + varText }));
    }
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const goNext = () => {
    setError(null);
    if (step === 'basic') {
      if (!form.name) { setError('Template name is required'); return; }
      if (!/^[a-z0-9_]+$/.test(form.name)) { setError('Only lowercase letters, numbers, and underscores'); return; }
    }
    if (step === 'header' && form.headerType === 'MEDIA' && !form.headerMediaHandle) {
      setError('Please upload media before proceeding to the next step');
      return;
    }
    if (step === 'body') {
      if (!form.bodyText) { setError('Body text is required'); return; }
      if (bodyVariables.some(n => !form.bodySamples[n]?.trim())) {
        setError('Please provide a sample value for each variable');
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

  const handleSubmit = async () => {
    const components: TemplateComponent[] = [];
    if (form.headerType === 'TEXT' && form.headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: form.headerText });
    }
    if (form.headerType === 'MEDIA' && form.headerMediaHandle) {
      components.push({
        type: 'HEADER',
        format: form.headerMediaType,
        example: { header_handle: [form.headerMediaHandle] },
      });
    }
    components.push({
      type: 'BODY',
      text: form.bodyText,
      ...(bodyVariables.length > 0 && {
        example: { body_text: [bodyVariables.map(n => form.bodySamples[n] ?? '')] },
      }),
    });
    if (form.footerText) {
      components.push({ type: 'FOOTER', text: form.footerText });
    }
    if (form.buttonType !== 'NONE' && form.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: form.buttons.map(b =>
          form.buttonType === 'QUICK_REPLY'
            ? { type: 'QUICK_REPLY' as const, text: b.text }
            : b.actionType === 'URL'
              ? { type: 'URL' as const, text: b.text, url: b.url ?? '' }
              : { type: 'PHONE_NUMBER' as const, text: b.text, phone_number: b.phone ?? '' }
        ),
      });
    }
    try {
      setSubmitting(true);
      setError(null);
      await templateApi.createTemplate({ name: form.name, language: form.language, category: form.category, components });
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to submit template'));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = CATEGORIES.find(c => c.value === form.category)?.label ?? form.category;
  const languageLabel = LANGUAGES.find(l => l.value === form.language)?.label ?? form.language;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-8">
      <button onClick={goBack} className="flex items-center gap-1.5 text-[#2d9c8f] font-semibold text-sm mb-6 hover:opacity-80 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
        Back to previous page
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">Adding New WhatsApp Template</h2>
      <p className="text-sm text-gray-500 mb-6">You can create your broadcast message template here.</p>

      {/* Progress bar */}
      <div className="relative h-2 bg-[#c8ede9] rounded-full mb-8">
        <div
          className="absolute left-0 top-0 h-2 bg-[#2d9c8f] rounded-full transition-all duration-500"
          style={{ width: `${((stepIndex) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.slice(1, -1).map((_, i) => {
          const pct = ((i + 1) / (STEPS.length - 1)) * 100;
          const passed = stepIndex > i + 1;
          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all ${passed ? 'bg-[#2d9c8f] border-[#2d9c8f]' : 'bg-white border-gray-300'}`}
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700 font-medium">{error}</div>
      )}

      <div className="grid grid-cols-[1fr_260px] gap-6 items-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6">

          {step === 'basic' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp Account</label>
                <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium text-sm">Sharing Happiness</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message Template Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="Type the name of your message template"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and underscores</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => (
                    <label key={cat.value} className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${form.category === cat.value ? 'border-[#2d9c8f] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="category" value={cat.value} checked={form.category === cat.value} onChange={() => setForm(p => ({ ...p, category: cat.value }))} className="mt-0.5 accent-[#2d9c8f]" />
                      <div>
                        <div className="font-semibold text-sm text-gray-800">{cat.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{cat.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Languages</label>
                <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 'header' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Header <span className="font-normal text-gray-400">Optional</span></h3>
              <p className="text-sm text-gray-500 mb-4">Add a title or choose which type of media you&apos;ll use for this header.</p>
              <select
                value={form.headerType}
                onChange={e => {
                  const headerType = e.target.value as FormState['headerType'];
                  if (form.headerMediaPreviewUrl) URL.revokeObjectURL(form.headerMediaPreviewUrl);
                  setHeaderMediaError(null);
                  setForm(p => ({ ...p, headerType, headerMediaFile: null, headerMediaHandle: null, headerMediaPreviewUrl: null }));
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm mb-3"
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text</option>
                <option value="MEDIA">Media</option>
              </select>

              {form.headerType === 'TEXT' && (
                <input type="text" value={form.headerText} onChange={e => setForm(p => ({ ...p, headerText: e.target.value }))} placeholder="Enter header text" maxLength={60} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm" />
              )}

              {form.headerType === 'MEDIA' && (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {MEDIA_TYPES.map(mt => (
                      <button
                        key={mt.value}
                        type="button"
                        onClick={() => {
                          if (mt.value === form.headerMediaType) return;
                          if (form.headerMediaPreviewUrl) URL.revokeObjectURL(form.headerMediaPreviewUrl);
                          setHeaderMediaError(null);
                          setForm(p => ({ ...p, headerMediaType: mt.value, headerMediaFile: null, headerMediaHandle: null, headerMediaPreviewUrl: null }));
                        }}
                        className={`flex flex-col items-center gap-1.5 py-6 border rounded-lg transition-all ${form.headerMediaType === mt.value ? 'border-[#2d9c8f] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <mt.icon className="w-5 h-5 text-[#2d9c8f]" />
                        <span className="text-sm font-medium text-gray-700">{mt.label}</span>
                      </button>
                    ))}
                  </div>

                  {!form.headerMediaFile && !headerMediaUploading && (
                    <p className="text-sm text-gray-500 mb-3">Please upload media before proceeding to the next step</p>
                  )}

                  <label className="block w-full text-center px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                    {HEADER_MEDIA_HINT[form.headerMediaType]}
                    <input type="file" accept={HEADER_MEDIA_ACCEPT[form.headerMediaType]} className="hidden" onChange={e => void handleHeaderMediaFileChange(e)} />
                  </label>

                  {headerMediaError && (
                    <p className="text-xs text-red-600 mt-2">{headerMediaError}</p>
                  )}

                  {(form.headerMediaFile || headerMediaUploading) && (
                    <div className="flex items-center justify-between border border-dashed border-gray-300 rounded-lg px-4 py-3 mt-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700 truncate">{form.headerMediaFile?.name ?? 'Uploading...'}</p>
                          <p className="text-xs text-gray-400">
                            {headerMediaUploading ? 'Uploading...' : form.headerMediaFile ? formatFileSize(form.headerMediaFile.size) : ''}
                          </p>
                        </div>
                      </div>
                      {!headerMediaUploading && (
                        <button type="button" onClick={removeHeaderMedia} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'body' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Body</h3>
              <p className="text-sm text-gray-500 mb-4">Enter the text for your message in the language you&apos;ve selected.</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#2d9c8f] transition-colors">
                <textarea
                  ref={bodyRef}
                  value={form.bodyText}
                  onChange={e => setForm(p => ({ ...p, bodyText: e.target.value }))}
                  placeholder="Example: Hai {{1}}, pesanan kamu dengan nomor {{2}} sudah kami proses."
                  rows={5}
                  maxLength={1024}
                  className="w-full px-4 py-3 focus:outline-none text-sm resize-none"
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={insertVariable}
                    className="flex items-center gap-1.5 text-[#2d9c8f] font-semibold text-xs hover:opacity-80 transition-opacity px-2 py-1 rounded hover:bg-[#e8f5f3]"
                  >
                    <span className="text-base leading-none">+</span>
                    Add Variable
                  </button>
                  <span className="text-xs text-gray-400">{form.bodyText.length}/1024</span>
                </div>
              </div>
              {bodyVariables.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Samples for body content</h4>
                  <p className="text-xs text-gray-500 mb-3">To help us review your content, provide examples of the variables. Do not include real customer information.</p>
                  <div className="space-y-2">
                    {bodyVariables.map(num => (
                      <div key={num}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Variable Content {`{{${num}}}`} *</label>
                        <input
                          type="text"
                          value={form.bodySamples[num] ?? ''}
                          onChange={e => setForm(p => ({ ...p, bodySamples: { ...p.bodySamples, [num]: e.target.value } }))}
                          placeholder={`Type content for {{${num}}}`}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'footer' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Footer <span className="font-normal text-gray-400">Optional</span></h3>
              <p className="text-sm text-gray-500 mb-4">Add a short line of text at the bottom of your message template.</p>
              <input type="text" value={form.footerText} onChange={e => setForm(p => ({ ...p, footerText: e.target.value }))} placeholder="Enter your text" maxLength={60} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm" />
              <p className="text-xs text-gray-400 text-right mt-1">{form.footerText.length}/60</p>
            </div>
          )}

          {step === 'buttons' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Buttons <span className="font-normal text-gray-400">Optional</span></h3>
              <p className="text-sm text-gray-500 mb-4">Create buttons that allow customers to respond to your message or take action.</p>
              <select
                value={form.buttonType}
                onChange={e => {
                  const bt = e.target.value as FormState['buttonType'];
                  setForm(p => ({ ...p, buttonType: bt, buttons: bt === 'NONE' ? [] : bt === 'QUICK_REPLY' ? [{ text: '' }] : [{ text: '', actionType: 'URL' as const, url: '' }] }));
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm mb-4"
              >
                <option value="NONE">None</option>
                <option value="CALL_TO_ACTION">Call to action</option>
                <option value="QUICK_REPLY">Quick Reply — Custom</option>
              </select>
              {form.buttonType === 'QUICK_REPLY' && (
                <div className="space-y-2">
                  {form.buttons.map((btn, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={btn.text} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, text: e.target.value } : b) }))} placeholder="Button text" maxLength={25} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#2d9c8f] focus:outline-none text-sm" />
                      <button onClick={() => setForm(p => ({ ...p, buttons: p.buttons.filter((_, bi) => bi !== i) }))} className="text-gray-300 hover:text-red-400 text-xl font-bold leading-none">×</button>
                    </div>
                  ))}
                  {form.buttons.length < 3 && <button onClick={() => setForm(p => ({ ...p, buttons: [...p.buttons, { text: '' }] }))} className="text-sm text-[#2d9c8f] font-semibold hover:opacity-80">+ Add button</button>}
                </div>
              )}
              {form.buttonType === 'CALL_TO_ACTION' && (
                <div className="space-y-3">
                  {form.buttons.map((btn, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <select value={btn.actionType} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, actionType: e.target.value as 'URL' | 'PHONE' } : b) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none">
                        <option value="URL">Visit Website</option>
                        <option value="PHONE">Call Phone Number</option>
                      </select>
                      <input type="text" value={btn.text} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, text: e.target.value } : b) }))} placeholder="Button text" maxLength={25} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none" />
                      {btn.actionType === 'URL' && <input type="url" value={btn.url ?? ''} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, url: e.target.value } : b) }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none" />}
                      {btn.actionType === 'PHONE' && <input type="tel" value={btn.phone ?? ''} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, phone: e.target.value } : b) }))} placeholder="+62..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#2d9c8f] focus:outline-none" />}
                    </div>
                  ))}
                  {form.buttons.length < 2 && <button onClick={() => setForm(p => ({ ...p, buttons: [...p.buttons, { text: '', actionType: 'URL', url: '' }] }))} className="text-sm text-[#2d9c8f] font-semibold hover:opacity-80">+ Add button</button>}
                </div>
              )}
            </div>
          )}

          {step === 'summary' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Summary Your Broadcast Template</h3>
              <p className="text-sm text-gray-500 mb-4">Review your broadcast structure before submitting the template.</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                {[['WhatsApp Account', 'Sharing Happiness'], ['Template Name', form.name], ['Category', categoryLabel], ['Language', languageLabel]].map(([k, v]) => (
                  <div key={k} className="flex border-b border-gray-100 last:border-0">
                    <div className="px-4 py-3 text-gray-500 w-44 shrink-0">{k}</div>
                    <div className="px-4 py-3 font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
                <div className="border border-[#2d9c8f] m-3 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Content</p>
                  {form.headerType === 'TEXT' && form.headerText && <p className="font-bold text-gray-900 mb-1">{form.headerText}</p>}
                  {form.headerType === 'MEDIA' && form.headerMediaFile && (
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-2">
                      {form.headerMediaType === 'IMAGE' && <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                      {form.headerMediaType === 'VIDEO' && <VideoIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                      {form.headerMediaType === 'DOCUMENT' && <FileText className="w-4 h-4 text-gray-400 shrink-0" />}
                      <span className="text-xs text-gray-600 truncate">{form.headerMediaFile.name}</span>
                    </div>
                  )}
                  <p className="font-semibold text-gray-800 whitespace-pre-wrap">{form.bodyText}</p>
                  {form.footerText && <p className="text-xs text-gray-400 mt-2 italic">{form.footerText}</p>}
                  {form.buttons.filter(b => b.text).length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {form.buttons.filter(b => b.text).map((b, i) => <span key={i} className="text-xs border border-[#2d9c8f] text-[#2d9c8f] px-3 py-1 rounded-lg">{b.text}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <button onClick={goBack} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </button>
            {step !== 'summary' ? (
              <button onClick={goNext} className="px-8 py-2.5 bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all">Next</button>
            ) : (
              <button onClick={() => void handleSubmit()} disabled={submitting} className="px-8 py-2.5 bg-[#2d9c8f] text-white rounded-lg text-sm font-semibold hover:bg-[#258577] transition-all disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Template'}
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-[#ede7dc] rounded-xl p-4 sticky top-0">
          <p className="font-bold text-gray-800 mb-3">Preview</p>
          <div className="bg-white rounded-xl shadow-sm p-4 min-h-[80px]">
            {form.headerType === 'TEXT' && form.headerText && <p className="font-bold text-gray-900 text-sm mb-1">{form.headerText}</p>}
            {form.headerType === 'MEDIA' && (
              <div className="mb-2">
                {form.headerMediaType === 'IMAGE' && form.headerMediaPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.headerMediaPreviewUrl} alt="" className="w-full rounded-lg max-h-40 object-cover" />
                )}
                {form.headerMediaType === 'VIDEO' && form.headerMediaPreviewUrl && (
                  <video src={form.headerMediaPreviewUrl} className="w-full rounded-lg max-h-40" controls />
                )}
                {form.headerMediaType === 'DOCUMENT' && form.headerMediaFile && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{form.headerMediaFile.name}</span>
                  </div>
                )}
                {!form.headerMediaFile && (
                  <div className="flex items-center justify-center bg-gray-100 rounded-lg h-24 text-gray-300">
                    {form.headerMediaType === 'IMAGE' && <ImageIcon className="w-6 h-6" />}
                    {form.headerMediaType === 'VIDEO' && <VideoIcon className="w-6 h-6" />}
                    {form.headerMediaType === 'DOCUMENT' && <FileText className="w-6 h-6" />}
                  </div>
                )}
              </div>
            )}
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{form.bodyText || <span className="text-gray-300 not-italic">—</span>}</p>
            {form.footerText && <p className="text-xs text-gray-400 mt-2">{form.footerText}</p>}
            {form.buttons.filter(b => b.text).length > 0 && (
              <div className="border-t border-gray-100 mt-3 pt-2 space-y-1.5">
                {form.buttons.filter(b => b.text).map((b, i) => (
                  <div key={i} className="text-center text-sm text-[#0093E9] font-medium">{b.text}</div>
                ))}
              </div>
            )}
            <p className="text-right text-xs text-gray-400 mt-2">5:09 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
