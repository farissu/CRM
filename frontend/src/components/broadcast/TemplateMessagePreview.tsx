'use client';

import React from 'react';
import { Image as ImageIcon, Video as VideoIcon, FileText } from 'lucide-react';
import type { TemplateComponent } from '@/types';

interface TemplateMessagePreviewProps {
  components: TemplateComponent[];
  timestamp?: string;
}

export default function TemplateMessagePreview({ components, timestamp }: TemplateMessagePreviewProps) {
  const header = components.find(c => c.type === 'HEADER');
  const body = components.find(c => c.type === 'BODY');
  const footer = components.find(c => c.type === 'FOOTER');
  const buttons = components.find(c => c.type === 'BUTTONS');
  const carousel = components.find(c => c.type === 'CAROUSEL');

  const headerMediaUrl = header?.format && header.format !== 'TEXT' ? header.example?.header_handle?.[0] : undefined;
  const isResolvableMediaUrl = Boolean(headerMediaUrl?.startsWith('http'));

  return (
    <>
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
          {buttons.buttons.map((b, i) =>
            b.type === 'URL' && b.url ? (
              <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-[#0093E9] font-medium hover:underline">
                {b.text}
              </a>
            ) : b.type === 'PHONE_NUMBER' && b.phone_number ? (
              <a key={i} href={`tel:${b.phone_number}`} className="block text-center text-sm text-[#0093E9] font-medium hover:underline">
                {b.text}
              </a>
            ) : (
              <div key={i} className="text-center text-sm text-[#0093E9] font-medium">{b.text}</div>
            )
          )}
        </div>
      )}
      {carousel?.cards && carousel.cards.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3 -mx-1 px-1">
          {carousel.cards.map((card, i) => {
            const cardHeader = card.components.find(cc => cc.type === 'HEADER');
            const cardBody = card.components.find(cc => cc.type === 'BODY');
            const cardButtons = card.components.find(cc => cc.type === 'BUTTONS');
            const cardMediaUrl = cardHeader?.format && cardHeader.format !== 'TEXT' ? cardHeader.example?.header_handle?.[0] : undefined;
            const cardMediaResolvable = Boolean(cardMediaUrl?.startsWith('http'));
            return (
              <div key={i} className="shrink-0 w-36 border border-gray-100 rounded-lg overflow-hidden">
                <div className="h-20 bg-gray-100 flex items-center justify-center">
                  {cardMediaResolvable && cardHeader?.format === 'IMAGE' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cardMediaUrl} alt="" className="w-full h-full object-cover" />
                  ) : cardMediaResolvable && cardHeader?.format === 'VIDEO' ? (
                    <video src={cardMediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-700 line-clamp-2">{cardBody?.text || `Card ${i + 1}`}</p>
                  {cardButtons?.buttons?.[0]?.text && (
                    <p className="text-xs text-[#0093E9] font-medium truncate mt-1">{cardButtons.buttons[0].text}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {timestamp && <p className="text-right text-xs text-gray-400 mt-2">{timestamp}</p>}
    </>
  );
}
