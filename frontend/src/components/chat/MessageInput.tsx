import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTypingStop();
    }, 1000);
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      
      // Reset textarea height to minimum
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
      
      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        onTypingStop();
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white border-t border-saas-border px-6 py-4">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-saas-bg border-2 border-saas-border rounded-2xl px-5 py-3.5 focus:outline-none focus:border-saas-primary-blue text-sm disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 font-medium placeholder:text-gray-400"
          style={{ minHeight: '48px', maxHeight: '96px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white p-4 rounded-2xl hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100 shadow-soft-sm"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
