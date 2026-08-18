import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Tag, Star, ChevronLeft, CheckCircle } from 'lucide-react';
import type { Conversation, Message } from '@/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ManageLabelsModal from './ManageLabelsModal';
import ConfirmDialog from './ConfirmDialog';
import SendTemplateModal from './SendTemplateModal';

// Helper function to format date for separator
function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Reset time to compare dates only
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);
  
  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    // Format: "Tue, 10 Feb" or with year if different year
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    };
    
    if (messageDate.getFullYear() !== today.getFullYear()) {
      options.year = 'numeric';
    }
    
    return messageDate.toLocaleDateString('en-US', options);
  }
}

// Helper function to check if two dates are same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// DateSeparator component
function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-gray-100 rounded-full px-4 py-1.5 shadow-sm">
        <span className="text-xs font-semibold text-gray-600">{date}</span>
      </div>
    </div>
  );
}

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  loading?: boolean;
  hasMoreMessages?: boolean;
  loadingMoreMessages?: boolean;
  onLoadMoreMessages?: () => void;
  onSendMessage: (text: string, file?: File, quotedMessageId?: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onResolveConversation?: () => void;
  onConversationUpdate?: () => void;
  onSendCsat?: () => Promise<void>;
  typingIndicator?: { agentName: string } | null;
  onBack?: () => void;
}

export default function ChatPanel({
  conversation,
  messages,
  loading,
  hasMoreMessages,
  loadingMoreMessages,
  onLoadMoreMessages,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onResolveConversation,
  onConversationUpdate,
  onSendCsat,
  typingIndicator,
  onBack,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [sendingCsat, setSendingCsat] = useState(false);
  const [showCsatConfirm, setShowCsatConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleLoadMoreMessages = () => {
    if (!onLoadMoreMessages || loadingMoreMessages || !hasMoreMessages) return;
    const container = messagesContainerRef.current;
    if (container) prevScrollHeightRef.current = container.scrollHeight;
    isPrependingRef.current = true;
    onLoadMoreMessages();
  };

  useEffect(() => {
    // Loading older history prepends messages above what's visible — restore
    // the scroll offset so the content the user was reading doesn't jump.
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      }
      return;
    }
    // Jump instantly once the message list actually finishes rendering
    // (right after `loading` flips to false) so opening a conversation
    // always lands on the latest message, not wherever it happened to render.
    if (!loading) scrollToBottom('auto');
  }, [messages, loading]);

  useEffect(() => {
    if (!onLoadMoreMessages || !hasMoreMessages) return;
    const sentinel = topSentinelRef.current;
    const root = messagesContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMoreMessages();
      },
      { root, rootMargin: '150px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMoreMessages, hasMoreMessages, loadingMoreMessages, conversation?.id]);

  useEffect(() => {
    setReplyingTo(null);
  }, [conversation?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollButton(isScrolledUp);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-saas-bg">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-soft">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-700 text-lg font-semibold mb-2">Select a conversation to start chatting</p>
          <p className="text-gray-500 text-sm">Choose a conversation from the sidebar</p>
        </div>
      </div>
    );
  }

  const contactName = conversation.contact.name || conversation.contact.phoneNumber;

  const lastInboundMessage = [...messages].reverse().find(m => m.direction === 'INBOUND');
  const isWindowExpired = lastInboundMessage
    ? Date.now() - new Date(lastInboundMessage.timestamp).getTime() > CUSTOMER_SERVICE_WINDOW_MS
    : messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-saas-bg">
      {/* Header */}
      <div className="bg-saas-secondary-blue text-white px-3 md:px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-1 hover:bg-white/10 rounded-xl transition-all duration-200 flex-shrink-0"
              aria-label="Back to conversation list"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 shadow-soft-sm">
            <span className="text-xl font-bold">
              {contactName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <h2 className="font-bold text-lg leading-tight truncate">{contactName}</h2>
            <p className="text-sm text-white/80 font-medium leading-tight truncate">{conversation.contact.phoneNumber}</p>
            {/* Labels */}
            {conversation.contact.labels && conversation.contact.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {conversation.contact.labels.map((label) => (
                  <span
                    key={label.id}
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold text-white shadow-soft-sm"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onSendCsat && (
            <button
              onClick={() => setShowCsatConfirm(true)}
              disabled={sendingCsat || isWindowExpired}
              title={isWindowExpired ? 'Customer service window sudah lewat 24 jam, tidak bisa kirim pesan baru' : undefined}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2.5 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-soft-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">{sendingCsat ? 'Mengirim...' : 'Kirim Penilaian'}</span>
            </button>
          )}
          {conversation.status === 'OPEN' && onResolveConversation && (
            <button
              onClick={onResolveConversation}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-2.5 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-soft-sm flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Resolve</span>
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-105"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-soft border border-saas-border overflow-hidden z-50">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowLabelsModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-200 text-left text-gray-700"
                >
                  <Tag className="w-4 h-4" />
                  <span className="font-medium">Manage Labels</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-saas-primary-blue border-t-transparent mx-auto mb-3"></div>
              <p className="text-gray-500 font-medium">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 font-medium">No messages yet</p>
          </div>
        ) : (
          <>
            {hasMoreMessages && <div ref={topSentinelRef} className="h-1" />}
            {loadingMoreMessages && (
              <div className="py-3 flex justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-saas-primary-blue border-t-transparent"></div>
              </div>
            )}
            {messages.map((message, index) => {
              // Check if we need to show date separator
              let showDateSeparator = false;
              if (index === 0) {
                // Always show separator for first message
                showDateSeparator = true;
              } else {
                // Show separator if date is different from previous message
                const currentDate = new Date(message.timestamp);
                const previousDate = new Date(messages[index - 1].timestamp);
                showDateSeparator = !isSameDay(currentDate, previousDate);
              }

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <DateSeparator date={formatDateSeparator(new Date(message.timestamp))} />
                  )}
                  <MessageBubble message={message} onReply={setReplyingTo} />
                </React.Fragment>
              );
            })}
            {typingIndicator && (
              <div className="px-4 mb-3">
                <div className="bg-white max-w-[70%] rounded-2xl px-5 py-3 shadow-soft-sm border border-saas-border">
                  <p className="text-sm text-gray-600 italic font-medium">
                    {typingIndicator.agentName} is typing...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-28 right-8 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white rounded-2xl p-4 shadow-soft hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}

      {/* Message Input */}
      {isWindowExpired && conversation.status !== 'RESOLVED' ? (
        <div className="px-6 py-4 bg-white border-t border-saas-border flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            The{' '}
            <a
              href="https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages#customer-service-window"
              target="_blank"
              rel="noopener noreferrer"
              className="text-saas-primary-blue underline"
            >
              customer service window
            </a>{' '}
            has expired. You can send a broadcast to start the conversation.
          </p>
          <button
            onClick={() => setShowSendTemplateModal(true)}
            className="shrink-0 bg-[#2d9c8f] hover:bg-[#258577] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            Send Broadcast
          </button>
        </div>
      ) : (
        <MessageInput
          onSendMessage={onSendMessage}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          disabled={conversation.status === 'RESOLVED'}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

      {/* Manage Labels Modal */}
      <ManageLabelsModal
        contact={conversation.contact}
        isOpen={showLabelsModal}
        onClose={() => setShowLabelsModal(false)}
        onLabelsUpdated={() => {
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }}
      />

      {/* Send Template Modal (for expired customer service window) */}
      <SendTemplateModal
        contact={conversation.contact}
        isOpen={showSendTemplateModal}
        onClose={() => setShowSendTemplateModal(false)}
        onSent={() => {
          if (onConversationUpdate) {
            onConversationUpdate();
          }
        }}
      />

      {/* Send CSAT link confirmation */}
      <ConfirmDialog
        isOpen={showCsatConfirm}
        title="Kirim Penilaian"
        message="Kirim link penilaian ke pelanggan ini?"
        confirmText="Kirim"
        onCancel={() => setShowCsatConfirm(false)}
        onConfirm={async () => {
          setShowCsatConfirm(false);
          if (!onSendCsat) return;
          setSendingCsat(true);
          try {
            await onSendCsat();
          } finally {
            setSendingCsat(false);
          }
        }}
      />
    </div>
  );
}
