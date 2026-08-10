import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Check, CheckCheck, Image as ImageIcon, FileText, Video, Music, Download, X, ExternalLink, MoreVertical, Reply } from 'lucide-react';
import type { Message } from '@/types';
import { messageApi } from '@/lib/api';
import { QUICK_REACTIONS } from '@/lib/emojiData';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
}

function ReactionBadge({ reactions }: { reactions: Message['reactions'] }) {
  if (!reactions || reactions.length === 0) return null;
  const title = reactions
    .map(r => `${r.by === 'AGENT' ? (r.agentName || 'Agent') : 'Customer'}: ${r.emoji}`)
    .join(', ');
  return (
    <div
      title={title}
      className="absolute -bottom-2.5 right-2 bg-white border border-saas-border rounded-full px-1.5 py-0.5 shadow-sm flex items-center gap-0.5 text-sm leading-none"
    >
      {reactions.map((r, i) => <span key={i}>{r.emoji}</span>)}
    </div>
  );
}

function quotedPreviewText(quoted: NonNullable<Message['quotedMessage']>): string {
  if (quoted.text || quoted.caption) return quoted.text || quoted.caption || '';
  const LABELS: Record<string, string> = {
    IMAGE: '📷 Photo',
    VIDEO: '🎥 Video',
    DOCUMENT: '📄 Document',
    AUDIO: '🎵 Audio',
    STICKER: '✨ Sticker',
  };
  return LABELS[quoted.messageType] || '';
}

function QuotedMessagePreview({ quoted }: { quoted: NonNullable<Message['quotedMessage']> }) {
  return (
    <div className="mb-2 rounded-lg border-l-4 border-saas-primary-blue/50 bg-black/5 px-3 py-1.5">
      <p className="text-xs font-semibold text-saas-primary-blue">
        {quoted.direction === 'OUTBOUND' ? (quoted.sender?.name || 'You') : 'Customer'}
      </p>
      <p className="text-xs text-gray-600 truncate">{quotedPreviewText(quoted)}</p>
    </div>
  );
}

interface MessageMenuProps {
  menuRef: React.RefObject<HTMLDivElement>;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
  onReply?: () => void;
  onReact: (emoji: string) => void;
}

function MessageMenu({ menuRef, showMenu, setShowMenu, onReply, onReact }: MessageMenuProps) {
  return (
    <div ref={menuRef} className="relative self-center opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 rounded-full hover:bg-gray-200 text-gray-500"
        aria-label="Message options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {showMenu && (
        <div className="absolute z-20 top-full right-0 mt-1 w-48 bg-white border border-saas-border rounded-xl shadow-soft py-2">
          <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className="text-lg hover:scale-125 transition-transform"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {onReply && (
            <button
              onClick={onReply}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, onReply }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';
  const timestamp = format(new Date(message.timestamp), 'HH:mm');
  const hasMedia = message.messageType !== 'TEXT' && message.mediaUrl;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleReact = async (emoji: string) => {
    setShowMenu(false);
    const mine = message.reactions?.find(r => r.by === 'AGENT');
    const nextEmoji = mine?.emoji === emoji ? '' : emoji;
    try {
      await messageApi.reactToMessage(message.id, nextEmoji);
    } catch {
      alert('Gagal mengirim reaction');
    }
  };

  return (
    <div
      className={clsx(
        'group flex mb-3 px-4 items-center gap-1',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'relative max-w-[70%] rounded-2xl shadow-soft-sm transition-all duration-200',
          hasMedia ? 'overflow-hidden p-0' : 'px-5 py-3',
          isOutbound
            ? 'bg-gradient-to-br from-saas-chat-user to-blue-100 text-saas-text-primary border border-blue-200'
            : 'bg-saas-chat-agent text-saas-text-primary border border-saas-border'
        )}
      >
        <ReactionBadge reactions={message.reactions} />

        {/* Quoted reply preview */}
        {message.quotedMessage && (
          <div className={hasMedia ? 'px-5 pt-3' : ''}>
            <QuotedMessagePreview quoted={message.quotedMessage} />
          </div>
        )}

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
      <MessageMenu
        menuRef={menuRef}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        onReply={onReply && !isOutbound ? () => { onReply(message); setShowMenu(false); } : undefined}
        onReact={handleReact}
      />
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

  if (messageType === 'STICKER') {
    return (
      <div className="p-2">
        {failed ? (
          <MediaUnavailable icon={<ImageIcon className="w-8 h-8 text-gray-400 mx-auto" />} />
        ) : (
          <img
            src={src}
            alt="Sticker"
            className="w-28 h-28 object-contain block"
            onError={() => setFailed(true)}
          />
        )}
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
