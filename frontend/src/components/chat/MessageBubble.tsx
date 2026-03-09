import React from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/types';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const timestamp = format(new Date(message.timestamp), 'HH:mm');

  return (
    <div
      className={clsx(
        'flex mb-3 px-4',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={clsx(
          'max-w-[70%] rounded-2xl px-5 py-3 shadow-soft-sm transition-all duration-200',
          isOutbound
            ? 'bg-gradient-to-br from-saas-chat-user to-blue-100 text-saas-text-primary border border-blue-200'
            : 'bg-saas-chat-agent text-saas-text-primary border border-saas-border'
        )}
      >
        {/* Message Text */}
        <p className="text-sm whitespace-pre-wrap break-words font-medium leading-relaxed">{message.text}</p>

        {/* Timestamp and Status */}
        <div
          className={clsx(
            'flex items-center gap-1.5 mt-2',
            isOutbound ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-xs text-gray-500 font-medium">{timestamp}</span>
          {isOutbound && (
            <MessageStatus status={message.status} />
          )}
        </div>

        {/* Sender name for outbound messages */}
        {isOutbound && message.sender && (
          <div className="text-xs text-gray-500 mt-1.5 font-medium">
            {message.sender.name}
          </div>
        )}
      </div>
    </div>
  );
}

interface MessageStatusProps {
  status?: string;
}

function MessageStatus({ status }: MessageStatusProps) {
  switch (status) {
    case 'sent':
      return <Check className="w-4 h-4 text-gray-400" />;
    case 'delivered':
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    case 'read':
      return <CheckCheck className="w-4 h-4 text-saas-primary-blue" />;
    case 'failed':
      return <span className="text-xs text-red-500 font-semibold">Failed</span>;
    default:
      return null;
  }
}
