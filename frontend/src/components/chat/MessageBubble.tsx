import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Check, CheckCheck, Image as ImageIcon, FileText, Video, Music, Download, X, ExternalLink } from 'lucide-react';
import type { Message } from '@/types';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';
  const timestamp = format(new Date(message.timestamp), 'HH:mm');
  const hasMedia = message.messageType !== 'TEXT' && message.mediaUrl;

  return (
    <div
      className={clsx(
        'flex mb-3 px-4',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'max-w-[70%] rounded-2xl shadow-soft-sm transition-all duration-200',
          hasMedia ? 'overflow-hidden p-0' : 'px-5 py-3',
          isOutbound
            ? 'bg-gradient-to-br from-saas-chat-user to-blue-100 text-saas-text-primary border border-blue-200'
            : 'bg-saas-chat-agent text-saas-text-primary border border-saas-border'
        )}
      >
        {/* Media Content */}
        {hasMedia && <MediaContent message={message} />}

        {/* Text/Caption — hide legacy media-type fallback labels */}
        {(() => {
          const MEDIA_LABELS = new Set(['📷 Image', '🎥 Video', '🎵 Audio', '✨ Sticker']);
          const body = message.text || message.caption;
          if (!body || MEDIA_LABELS.has(body)) return null;
          return (
            <div className={hasMedia ? 'px-5 py-3' : ''}>
              <p className="text-sm whitespace-pre-wrap break-words font-medium leading-relaxed">
                {body}
              </p>
            </div>
          );
        })()}

        {/* Interactive cta_url button (e.g. CSAT/rating link) */}
        {message.metadata?.interactive?.buttonUrl && (
          <div className={hasMedia ? 'px-5 pb-3' : 'px-0'}>
            <a
              href={message.metadata.interactive.buttonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-white/70 hover:bg-white border border-saas-primary-blue/30 px-4 py-2 text-sm font-semibold text-saas-primary-blue transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {message.metadata.interactive.buttonText || 'Buka Link'}
            </a>
          </div>
        )}

        {/* Timestamp and Status */}
        <div
          className={clsx(
            'flex items-center gap-1.5',
            hasMedia ? 'px-5 pb-3' : 'mt-2',
            isOutbound ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-xs text-gray-500 font-medium">{timestamp}</span>
          {isOutbound && (
            <MessageStatus status={message.status} />
          )}
        </div>

        {/* Sender name for outbound messages */}
        {isOutbound && message.sender && !hasMedia && (
          <div className="text-xs text-gray-500 mt-1.5 font-medium">
            {message.sender.name}
          </div>
        )}
      </div>
    </div>
  );
}

interface MediaContentProps {
  message: Message;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function resolveMediaUrl(mediaUrl: string, downloadFileName?: string): string {
  const token = typeof window !== 'undefined' ? encodeURIComponent(localStorage.getItem('token') ?? '') : '';
  const filenameParam = downloadFileName ? `&filename=${encodeURIComponent(downloadFileName)}` : '';
  if (mediaUrl.startsWith('/uploads/')) return `${API_URL}${mediaUrl}?token=${token}${filenameParam}`;
  if (mediaUrl.startsWith('http')) return mediaUrl;
  if (mediaUrl.includes('/')) return `${API_URL}/api/messages/gcs-media/${mediaUrl}?token=${token}${filenameParam}`;
  return `${API_URL}/api/messages/media/${mediaUrl}?token=${token}${filenameParam}`;
}

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

function MediaUnavailable({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-32 bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="text-center">
        {icon}
        <p className="text-xs text-gray-500 mt-1">Media unavailable</p>
      </div>
    </div>
  );
}

function MediaContent({ message }: MediaContentProps) {
  const { messageType, mediaUrl } = message;
  const [failed, setFailed] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!mediaUrl) return null;

  const src = resolveMediaUrl(mediaUrl);

  if (messageType === 'IMAGE') {
    return (
      <div className="relative bg-gray-100 rounded-t-2xl overflow-hidden">
        {failed ? (
          <MediaUnavailable icon={<ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />} />
        ) : (
          <img
            src={src}
            alt={message.caption || 'Image'}
            className="max-w-full max-h-80 object-contain block cursor-zoom-in"
            onError={() => setFailed(true)}
            onClick={() => setIsLightboxOpen(true)}
          />
        )}
        {isLightboxOpen && (
          <ImageLightbox src={src} alt={message.caption || 'Image'} onClose={() => setIsLightboxOpen(false)} />
        )}
      </div>
    );
  }

  if (messageType === 'VIDEO') {
    return (
      <div className="relative bg-black rounded-t-2xl overflow-hidden">
        {failed ? (
          <MediaUnavailable icon={<Video className="w-8 h-8 text-gray-400 mx-auto" />} />
        ) : (
          <video
            src={src}
            controls
            className="max-w-full max-h-80 block"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  if (messageType === 'DOCUMENT') {
    return (
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-xl">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {message.fileName || 'Document'}
            </p>
            <p className="text-xs text-gray-500">
              {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : 'File'}
            </p>
          </div>
          <a
            href={resolveMediaUrl(mediaUrl, message.fileName || 'document')}
            download={message.fileName || 'document'}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </a>
        </div>
      </div>
    );
  }

  if (messageType === 'AUDIO') {
    return (
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-3 rounded-xl shrink-0">
            <Music className="w-6 h-6 text-green-600" />
          </div>
          <audio src={src} controls className="flex-1 h-8" />
        </div>
      </div>
    );
  }

  return null;
}

import type { MessageStatus as MessageStatusType } from '@/types';

interface MessageStatusProps {
  status?: MessageStatusType | null;
}

function MessageStatus({ status }: MessageStatusProps) {
  switch (status) {
    case 'SENT':
    case 'SENDING':
      return <Check className="w-4 h-4 text-gray-400" />;
    case 'DELIVERED':
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    case 'READ':
      return <CheckCheck className="w-4 h-4 text-saas-primary-blue" />;
    case 'FAILED':
      return <span className="text-xs text-red-500 font-semibold">Failed</span>;
    default:
      return null;
  }
}
