'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, MessageSquare, Copy, Check, Image as ImageIcon, Video as VideoIcon, FileText } from 'lucide-react';
import type { MessageTemplate, TemplateStatus } from '@/types';
import { templateApi } from '@/lib/api';

interface TemplateDetailProps {
  template: MessageTemplate;
  onBack: () => void;
}

const STATUS_COLORS: Record<TemplateStatus, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAUSED: 'bg-gray-100 text-gray-600',
  DISABLED: 'bg-gray-100 text-gray-400',
};

const QUALITY_COLORS: Record<string, string> = {
  GREEN: 'bg-green-100 text-green-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  RED: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-gray-100 text-gray-500',
};

const LANGUAGE_LABELS: Record<string, string> = {
  id: 'Indonesian',
  en_US: 'English (US)',
  en: 'English',
};

function formatLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function TemplateDetail({ template, onBack }: TemplateDetailProps) {
  const [wabaId, setWabaId] = useState<string | null>(null);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void templateApi.getWabaInfo().then(res => {
      if (!cancelled) {
        setWabaId(res.wabaId);
        setNamespace(res.namespace);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const header = template.components.find(c => c.type === 'HEADER');
  const body = template.components.find(c => c.type === 'BODY');
  const footer = template.components.find(c => c.type === 'FOOTER');
  const buttons = template.components.find(c => c.type === 'BUTTONS');

  const headerMediaUrl =
    header?.format && header.format !== 'TEXT'
      ? header.example?.header_handle?.[0]
      : undefined;
  const isResolvableMediaUrl = Boolean(headerMediaUrl?.startsWith('http'));

  const handleCopyMediaLink = () => {
    if (!headerMediaUrl) return;
    void navigator.clipboard.writeText(headerMediaUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const quality = template.qualityScore ?? 'UNKNOWN';

  const rows: [string, React.ReactNode][] = [
    ['WABA ID', wabaId ?? '—'],
    ['Category', formatLabel(template.category)],
    ['Language', LANGUAGE_LABELS[template.language] ?? template.language],
    [
      'Quality',
      <span key="quality" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${QUALITY_COLORS[quality] ?? QUALITY_COLORS.UNKNOWN}`}>
        {formatLabel(quality)}
      </span>,
    ],
    ['Broadcast Price', '—'],
    ['Namespace', namespace ?? '—'],
    ['Checker Template By', '—'],
    ['Created By', 'Sharing Happiness'],
    ['Reason Rejected', template.rejectedReason ?? '—'],
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-[#2d9c8f] font-semibold hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-4 h-4" />
          WhatsApp Template
        </button>
        <span>&gt;</span>
        <span className="font-semibold text-gray-700">Template Details</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex items-center gap-3 px-5 py-4 mb-6">
        <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{template.name}</h2>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[template.status]}`}>
          {formatLabel(template.status)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex border-b border-gray-100 last:border-0">
              <div className="px-5 py-3 text-gray-500 w-48 shrink-0">{k}</div>
              <div className="px-5 py-3 font-semibold text-gray-800">{v}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#ede7dc] rounded-xl p-4 sticky top-0">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-800">Preview</p>
            {isResolvableMediaUrl && (
              <button onClick={handleCopyMediaLink} className="flex items-center gap-1.5 text-xs font-semibold text-[#2d9c8f] hover:opacity-80 transition-opacity">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Media Link'}
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 min-h-[80px]">
            {header?.format && header.format !== 'TEXT' && (
              <div className="mb-2">
                {isResolvableMediaUrl && header.format === 'IMAGE' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerMediaUrl} alt="" className="w-full rounded-lg max-h-52 object-cover" />
                )}
                {isResolvableMediaUrl && header.format === 'VIDEO' && (
                  <video src={headerMediaUrl} className="w-full rounded-lg max-h-52" controls />
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
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{body?.text}</p>
            {footer?.text && <p className="text-xs text-gray-400 mt-2">{footer.text}</p>}
            {buttons?.buttons && buttons.buttons.length > 0 && (
              <div className="border-t border-gray-100 mt-3 pt-2 space-y-1.5">
                {buttons.buttons.map((b, i) => (
                  <div key={i} className="text-center text-sm text-[#0093E9] font-medium">{b.text}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
