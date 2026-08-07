'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Plus, Image as ImageIcon, Video as VideoIcon, FileText, X } from 'lucide-react';
import type { TemplateCategory, TemplateComponent } from '@/types';
import { templateApi } from '@/lib/api';
import { CATEGORIES, MARKETING_MESSAGE_TYPES, type MarketingMessageType } from '@/lib/templateConstants';

interface CreateTemplateWizardProps {
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'basic' | 'header' | 'body' | 'footer' | 'buttons' | 'carousel' | 'summary';

const GENERAL_STEPS: { key: Step; label: string }[] = [
  { key: 'basic', label: 'Template Info' },
  { key: 'header', label: 'Header' },
  { key: 'body', label: 'Body' },
  { key: 'footer', label: 'Footer' },
  { key: 'buttons', label: 'Buttons' },
  { key: 'summary', label: 'Summary' },
];

const CAROUSEL_STEPS: { key: Step; label: string }[] = [
  { key: 'basic', label: 'Template Info' },
  { key: 'body', label: 'Body' },
  { key: 'carousel', label: 'Carousel' },
  { key: 'summary', label: 'Summary' },
];

function isCarouselFlow(category: TemplateCategory, messageType: MarketingMessageType): boolean {
  return category === 'MARKETING' && messageType === 'CAROUSEL';
}

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

type CarouselHeaderFormat = 'IMAGE' | 'VIDEO';
type CarouselButtonFormat = 'URL' | 'QUICK_REPLY';

interface CarouselCard {
  id: string;
  headerFile: File | null;
  headerHandle: string | null;
  headerPreviewUrl: string | null;
  bodyText: string;
  buttonText: string;
  buttonUrl: string;
}

function createCarouselCard(): CarouselCard {
  return {
    id: Math.random().toString(36).slice(2),
    headerFile: null,
    headerHandle: null,
    headerPreviewUrl: null,
    bodyText: '',
    buttonText: '',
    buttonUrl: '',
  };
}

interface FormState {
  name: string;
  category: TemplateCategory;
  messageType: MarketingMessageType;
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
  carouselHeaderFormat: CarouselHeaderFormat;
  carouselButtonFormat: CarouselButtonFormat;
  carouselCards: CarouselCard[];
  carouselActiveCardId: string;
}

function createInitialForm(): FormState {
  const carouselCards = [createCarouselCard()];
  return {
    name: '', category: 'MARKETING', messageType: 'GENERAL', language: 'id',
    headerType: 'NONE', headerText: '',
    headerMediaType: 'IMAGE', headerMediaFile: null, headerMediaHandle: null, headerMediaPreviewUrl: null,
    bodyText: '', bodySamples: {},
    footerText: '',
    buttonType: 'NONE', buttons: [],
    carouselHeaderFormat: 'IMAGE', carouselButtonFormat: 'URL',
    carouselCards,
    carouselActiveCardId: carouselCards[0].id,
  };
}

export default function CreateTemplateWizard({ onBack, onSuccess }: CreateTemplateWizardProps) {
  const [step, setStep] = useState<Step>('basic');
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [headerMediaUploading, setHeaderMediaUploading] = useState(false);
  const [headerMediaError, setHeaderMediaError] = useState<string | null>(null);
  const [carouselUploading, setCarouselUploading] = useState<Record<string, boolean>>({});
  const [carouselMediaError, setCarouselMediaError] = useState<Record<string, string | null>>({});
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const STEPS = isCarouselFlow(form.category, form.messageType) ? CAROUSEL_STEPS : GENERAL_STEPS;

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

  const handleCarouselCardFileChange = async (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const existing = form.carouselCards.find(c => c.id === cardId);
    if (existing?.headerPreviewUrl) URL.revokeObjectURL(existing.headerPreviewUrl);
    const previewUrl = URL.createObjectURL(file);

    setCarouselMediaError(p => ({ ...p, [cardId]: null }));
    setForm(p => ({
      ...p,
      carouselCards: p.carouselCards.map(c => c.id === cardId ? { ...c, headerFile: file, headerHandle: null, headerPreviewUrl: previewUrl } : c),
    }));

    try {
      setCarouselUploading(p => ({ ...p, [cardId]: true }));
      const res = await templateApi.uploadHeaderMedia(file);
      setForm(p => ({
        ...p,
        carouselCards: p.carouselCards.map(c => c.id === cardId ? { ...c, headerHandle: res.handle } : c),
      }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setCarouselMediaError(p => ({ ...p, [cardId]: axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to upload media') }));
      setForm(p => ({
        ...p,
        carouselCards: p.carouselCards.map(c => c.id === cardId ? { ...c, headerFile: null, headerPreviewUrl: null } : c),
      }));
    } finally {
      setCarouselUploading(p => ({ ...p, [cardId]: false }));
    }
  };

  const addCarouselCard = () => {
    setForm(p => {
      if (p.carouselCards.length >= 10) return p;
      const card = createCarouselCard();
      return { ...p, carouselCards: [...p.carouselCards, card], carouselActiveCardId: card.id };
    });
  };

  const removeCarouselCard = (cardId: string) => {
    setForm(p => {
      if (p.carouselCards.length <= 1) return p;
      const removed = p.carouselCards.find(c => c.id === cardId);
      if (removed?.headerPreviewUrl) URL.revokeObjectURL(removed.headerPreviewUrl);
      const remaining = p.carouselCards.filter(c => c.id !== cardId);
      const carouselActiveCardId = p.carouselActiveCardId === cardId ? remaining[0].id : p.carouselActiveCardId;
      return { ...p, carouselCards: remaining, carouselActiveCardId };
    });
  };

  const updateCarouselCard = (cardId: string, patch: Partial<CarouselCard>) => {
    setForm(p => ({ ...p, carouselCards: p.carouselCards.map(c => c.id === cardId ? { ...c, ...patch } : c) }));
  };

  const activeCarouselCard = form.carouselCards.find(c => c.id === form.carouselActiveCardId) ?? form.carouselCards[0];

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
    if (step === 'carousel') {
      if (form.carouselCards.length < 1) { setError('Carousel templates need at least 1 card'); return; }
      const incomplete = form.carouselCards.find(c =>
        !c.headerHandle || !c.bodyText.trim() || !c.buttonText.trim() || (form.carouselButtonFormat === 'URL' && !c.buttonUrl.trim())
      );
      if (incomplete) { setError('Please complete the header, body, and button for every carousel card'); return; }
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

    if (isCarouselFlow(form.category, form.messageType)) {
      components.push({
        type: 'BODY',
        text: form.bodyText,
        ...(bodyVariables.length > 0 && {
          example: { body_text: [bodyVariables.map(n => form.bodySamples[n] ?? '')] },
        }),
      });
      components.push({
        type: 'CAROUSEL',
        cards: form.carouselCards.map(card => ({
          components: [
            {
              type: 'HEADER' as const,
              format: form.carouselHeaderFormat,
              example: { header_handle: [card.headerHandle ?? ''] },
            },
            { type: 'BODY' as const, text: card.bodyText },
            {
              type: 'BUTTONS' as const,
              buttons: form.carouselButtonFormat === 'URL'
                ? [{ type: 'URL' as const, text: card.buttonText, url: card.buttonUrl }]
                : [{ type: 'QUICK_REPLY' as const, text: card.buttonText }],
            },
          ],
        })),
      });
    } else {
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
  const messageTypeLabel = MARKETING_MESSAGE_TYPES.find(m => m.value === form.messageType)?.label ?? form.messageType;
  const languageLabel = LANGUAGES.find(l => l.value === form.language)?.label ?? form.language;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-8">
      <button onClick={goBack} className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-sm mb-6 hover:opacity-80 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
        Back to previous page
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">Adding New WhatsApp Template</h2>
      <p className="text-sm text-gray-500 mb-6">You can create your broadcast message template here.</p>

      {/* Progress bar */}
      <div className="relative h-2 bg-[#c8ede9] rounded-full mb-8">
        <div
          className="absolute left-0 top-0 h-2 bg-[#597ea3] rounded-full transition-all duration-500"
          style={{ width: `${((stepIndex) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.slice(1, -1).map((_, i) => {
          const pct = ((i + 1) / (STEPS.length - 1)) * 100;
          const passed = stepIndex > i + 1;
          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all ${passed ? 'bg-[#597ea3] border-[#597ea3]' : 'bg-white border-gray-300'}`}
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and underscores</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => (
                    <div key={cat.value}>
                      <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${form.category === cat.value ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="category"
                          value={cat.value}
                          checked={form.category === cat.value}
                          onChange={() => setForm(p => ({ ...p, category: cat.value, messageType: cat.value === 'MARKETING' ? p.messageType : 'GENERAL' }))}
                          className="mt-0.5 accent-[#597ea3]"
                        />
                        <div>
                          <div className="font-semibold text-sm text-gray-800">{cat.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{cat.description}</div>
                        </div>
                      </label>
                      {cat.value === 'MARKETING' && form.category === 'MARKETING' && (
                        <div className="ml-4 mt-2 space-y-2 border-l-2 border-[#c8ede9] pl-4">
                          {MARKETING_MESSAGE_TYPES.map(mt => (
                            <label key={mt.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${form.messageType === mt.value ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}>
                              <input
                                type="radio"
                                name="messageType"
                                value={mt.value}
                                checked={form.messageType === mt.value}
                                onChange={() => setForm(p => ({ ...p, messageType: mt.value }))}
                                className="mt-0.5 accent-[#597ea3]"
                              />
                              <div>
                                <div className="font-semibold text-sm text-gray-800">{mt.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{mt.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Languages</label>
                <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm">
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm mb-3"
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text</option>
                <option value="MEDIA">Media</option>
              </select>

              {form.headerType === 'TEXT' && (
                <input type="text" value={form.headerText} onChange={e => setForm(p => ({ ...p, headerText: e.target.value }))} placeholder="Enter header text" maxLength={60} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm" />
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
                        className={`flex flex-col items-center gap-1.5 py-6 border rounded-lg transition-all ${form.headerMediaType === mt.value ? 'border-[#597ea3] bg-[#f0faf9]' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <mt.icon className="w-5 h-5 text-[#597ea3]" />
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
              <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#597ea3] transition-colors">
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
                    className="flex items-center gap-1.5 text-[#597ea3] font-semibold text-xs hover:opacity-80 transition-opacity px-2 py-1 rounded hover:bg-[#eef6ff]"
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
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
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
              <input type="text" value={form.footerText} onChange={e => setForm(p => ({ ...p, footerText: e.target.value }))} placeholder="Enter your text" maxLength={60} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm" />
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm mb-4"
              >
                <option value="NONE">None</option>
                <option value="CALL_TO_ACTION">Call to action</option>
                <option value="QUICK_REPLY">Quick Reply — Custom</option>
              </select>
              {form.buttonType === 'QUICK_REPLY' && (
                <div className="space-y-2">
                  {form.buttons.map((btn, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={btn.text} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, text: e.target.value } : b) }))} placeholder="Button text" maxLength={25} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm" />
                      <button onClick={() => setForm(p => ({ ...p, buttons: p.buttons.filter((_, bi) => bi !== i) }))} className="text-gray-300 hover:text-red-400 text-xl font-bold leading-none">×</button>
                    </div>
                  ))}
                  {form.buttons.length < 3 && <button onClick={() => setForm(p => ({ ...p, buttons: [...p.buttons, { text: '' }] }))} className="text-sm text-[#597ea3] font-semibold hover:opacity-80">+ Add button</button>}
                </div>
              )}
              {form.buttonType === 'CALL_TO_ACTION' && (
                <div className="space-y-3">
                  {form.buttons.map((btn, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <select value={btn.actionType} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, actionType: e.target.value as 'URL' | 'PHONE' } : b) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none">
                        <option value="URL">Visit Website</option>
                        <option value="PHONE">Call Phone Number</option>
                      </select>
                      <input type="text" value={btn.text} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, text: e.target.value } : b) }))} placeholder="Button text" maxLength={25} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none" />
                      {btn.actionType === 'URL' && <input type="url" value={btn.url ?? ''} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, url: e.target.value } : b) }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none" />}
                      {btn.actionType === 'PHONE' && <input type="tel" value={btn.phone ?? ''} onChange={e => setForm(p => ({ ...p, buttons: p.buttons.map((b, bi) => bi === i ? { ...b, phone: e.target.value } : b) }))} placeholder="+62..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#597ea3] focus:outline-none" />}
                    </div>
                  ))}
                  {form.buttons.length < 2 && <button onClick={() => setForm(p => ({ ...p, buttons: [...p.buttons, { text: '', actionType: 'URL', url: '' }] }))} className="text-sm text-[#597ea3] font-semibold hover:opacity-80">+ Add button</button>}
                </div>
              )}
            </div>
          )}

          {step === 'carousel' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Carousel Setting</h3>
              <p className="text-sm text-gray-500 mb-4">Set the header and button format here. The format will remain consistent across all cards within the same template</p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Header Format</label>
                  <select
                    value={form.carouselHeaderFormat}
                    onChange={e => {
                      const carouselHeaderFormat = e.target.value as CarouselHeaderFormat;
                      setForm(p => {
                        p.carouselCards.forEach(c => { if (c.headerPreviewUrl) URL.revokeObjectURL(c.headerPreviewUrl); });
                        return {
                          ...p,
                          carouselHeaderFormat,
                          carouselCards: p.carouselCards.map(c => ({ ...c, headerFile: null, headerHandle: null, headerPreviewUrl: null })),
                        };
                      });
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                  >
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Button</label>
                  <select
                    value={form.carouselButtonFormat}
                    onChange={e => setForm(p => ({ ...p, carouselButtonFormat: e.target.value as CarouselButtonFormat }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                  >
                    <option value="URL">URL Button</option>
                    <option value="QUICK_REPLY">Quick Reply Button</option>
                  </select>
                </div>
              </div>

              <h3 className="font-bold text-gray-800 mb-1">Carousel Card</h3>
              <p className="text-sm text-gray-500 mb-3">Carousel templates support up to 10 carousel cards.</p>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {form.carouselCards.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, carouselActiveCardId: card.id }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${form.carouselActiveCardId === card.id ? 'bg-[#597ea3] text-white border-[#597ea3]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    Card {i + 1}
                    {form.carouselCards.length > 1 && (
                      <X
                        className="w-3.5 h-3.5"
                        onClick={e => { e.stopPropagation(); removeCarouselCard(card.id); }}
                      />
                    )}
                  </button>
                ))}
                {form.carouselCards.length < 10 && (
                  <button
                    type="button"
                    onClick={addCarouselCard}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-[#597ea3] hover:text-[#597ea3] transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Card
                  </button>
                )}
              </div>

              {activeCarouselCard && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Header</label>
                    <label className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#597ea3] hover:bg-[#416180] cursor-pointer transition-colors">
                      {activeCarouselCard.headerFile ? activeCarouselCard.headerFile.name : `Choose ${form.carouselHeaderFormat === 'IMAGE' ? 'JPG or PNG' : 'MP4 or 3GP'} File`}
                      <input
                        type="file"
                        accept={form.carouselHeaderFormat === 'IMAGE' ? HEADER_MEDIA_ACCEPT.IMAGE : HEADER_MEDIA_ACCEPT.VIDEO}
                        className="hidden"
                        onChange={e => void handleCarouselCardFileChange(activeCarouselCard.id, e)}
                      />
                    </label>
                    {carouselMediaError[activeCarouselCard.id] && (
                      <p className="text-xs text-red-600 mt-2">{carouselMediaError[activeCarouselCard.id]}</p>
                    )}
                    {carouselUploading[activeCarouselCard.id] && <p className="text-xs text-gray-400 mt-2">Uploading...</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Body</label>
                    <textarea
                      value={activeCarouselCard.bodyText}
                      onChange={e => updateCarouselCard(activeCarouselCard.id, { bodyText: e.target.value })}
                      rows={3}
                      maxLength={160}
                      placeholder="Enter the card body text"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">{activeCarouselCard.bodyText.length}/160</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {form.carouselButtonFormat === 'URL' ? 'URL Buttons' : 'Quick Reply Button'}
                    </label>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={activeCarouselCard.buttonText}
                      onChange={e => updateCarouselCard(activeCarouselCard.id, { buttonText: e.target.value })}
                      placeholder="Button text"
                      maxLength={25}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm mb-3"
                    />
                    {form.carouselButtonFormat === 'URL' && (
                      <>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Website URL</label>
                        <input
                          type="url"
                          value={activeCarouselCard.buttonUrl}
                          onChange={e => updateCarouselCard(activeCarouselCard.id, { buttonUrl: e.target.value })}
                          placeholder="www.qiscus.com"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-[#597ea3] focus:outline-none text-sm"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'summary' && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Summary Your Broadcast Template</h3>
              <p className="text-sm text-gray-500 mb-4">Review your broadcast structure before submitting the template.</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
                {[
                  ['WhatsApp Account', 'Sharing Happiness'],
                  ['Template Name', form.name],
                  ['Category', categoryLabel],
                  ...(form.category === 'MARKETING' ? [['Message Type', messageTypeLabel]] : []),
                  ['Language', languageLabel],
                ].map(([k, v]) => (
                  <div key={k} className="flex border-b border-gray-100 last:border-0">
                    <div className="px-4 py-3 text-gray-500 w-44 shrink-0">{k}</div>
                    <div className="px-4 py-3 font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
                <div className="border border-[#597ea3] m-3 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Content</p>
                  {isCarouselFlow(form.category, form.messageType) ? (
                    <>
                      <p className="font-semibold text-gray-800 whitespace-pre-wrap mb-3">{form.bodyText}</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {form.carouselCards.map((card, i) => (
                          <div key={card.id} className="shrink-0 w-40 border border-gray-100 rounded-lg overflow-hidden bg-gray-50">
                            <div className="h-20 bg-gray-100 flex items-center justify-center">
                              {card.headerPreviewUrl ? (
                                form.carouselHeaderFormat === 'IMAGE' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={card.headerPreviewUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <video src={card.headerPreviewUrl} className="w-full h-full object-cover" />
                                )
                              ) : (
                                <ImageIcon className="w-5 h-5 text-gray-300" />
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-xs text-gray-700 truncate">{card.bodyText || `Card ${i + 1}`}</p>
                              {card.buttonText && <p className="text-xs text-[#597ea3] font-semibold truncate mt-1">{card.buttonText}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
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
                          {form.buttons.filter(b => b.text).map((b, i) => <span key={i} className="text-xs border border-[#597ea3] text-[#597ea3] px-3 py-1 rounded-lg">{b.text}</span>)}
                        </div>
                      )}
                    </>
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
              <button onClick={goNext} className="px-8 py-2.5 bg-[#597ea3] text-white rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all">Next</button>
            ) : (
              <button onClick={() => void handleSubmit()} disabled={submitting} className="px-8 py-2.5 bg-[#597ea3] text-white rounded-lg text-sm font-semibold hover:bg-[#416180] transition-all disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Template'}
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-[#ede7dc] rounded-xl p-4 sticky top-0">
          <p className="font-bold text-gray-800 mb-3">Preview</p>
          <div className="bg-white rounded-xl shadow-sm p-4 min-h-[80px]">
            {isCarouselFlow(form.category, form.messageType) ? (
              <>
                <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{form.bodyText || <span className="text-gray-300 not-italic">—</span>}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {form.carouselCards.map((card, i) => (
                    <div key={card.id} className="shrink-0 w-32 border border-gray-100 rounded-lg overflow-hidden">
                      <div className="h-16 bg-gray-100 flex items-center justify-center">
                        {card.headerPreviewUrl ? (
                          form.carouselHeaderFormat === 'IMAGE' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.headerPreviewUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video src={card.headerPreviewUrl} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] text-gray-700 truncate">{card.bodyText || `Card ${i + 1}`}</p>
                        {card.buttonText && <p className="text-[11px] text-[#0093E9] font-medium truncate mt-1">{card.buttonText}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
            <p className="text-right text-xs text-gray-400 mt-2">5:09 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
