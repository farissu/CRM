import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Tag } from 'lucide-react';
import type { Conversation, Message } from '@/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ManageLabelsModal from './ManageLabelsModal';

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

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  loading?: boolean;
  onSendMessage: (text: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onResolveConversation?: () => void;
  onConversationUpdate?: () => void;
  typingIndicator?: { agentName: string } | null;
}

export default function ChatPanel({
  conversation,
  messages,
  loading,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onResolveConversation,
  onConversationUpdate,
  typingIndicator,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <div className="flex-1 flex flex-col h-full bg-saas-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 shadow-soft-sm">
            <span className="text-xl font-bold">
              {contactName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="font-bold text-lg leading-tight">{contactName}</h2>
            <p className="text-sm text-white/80 font-medium leading-tight">{conversation.contact.phoneNumber}</p>
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
          {conversation.status === 'open' && onResolveConversation && (
            <button
              onClick={onResolveConversation}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-soft-sm"
            >
              Resolve
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
        className="flex-1 overflow-y-auto p-6"
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
                  <MessageBubble message={message} />
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
          onClick={scrollToBottom}
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
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        disabled={conversation.status === 'resolved'}
      />

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
    </div>
  );
}
