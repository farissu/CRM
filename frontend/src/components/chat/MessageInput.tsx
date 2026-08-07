import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Image, FileText, Video, Music, MessageSquareText, Reply, Smile } from 'lucide-react';
import type { QuickReply, Message } from '@/types';
import { quickReplyApi } from '@/lib/api';
import { EMOJI_PICKER_GROUPS } from '@/lib/emojiData';

interface MessageInputProps {
  onSendMessage: (text: string, file?: File, quotedMessageId?: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export default function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    quickReplyApi.getQuickReplies({ active: true })
      .then(res => setQuickReplies(res.quickReplies))
      .catch(() => {});
  }, []);

  const handleSelectQuickReply = (quickReply: QuickReply) => {
    setMessage(quickReply.text);
    setShowQuickReplyPicker(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleInsertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? message.length;
    const end = textarea?.selectionEnd ?? message.length;
    const next = message.slice(0, start) + emoji + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

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
    if ((message.trim() || selectedFile) && !disabled) {
      onSendMessage(message.trim(), selectedFile ?? undefined, replyingTo?.id);

      setMessage('');
      setSelectedFile(null);
      setFilePreview(null);
      onCancelReply?.();

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (file.type.startsWith('video/')) return <Video className="w-5 h-5" />;
    if (file.type.startsWith('audio/')) return <Music className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
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

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  return (
    <div className="bg-white border-t border-saas-border px-6 py-4">
      {/* Reply banner */}
      {replyingTo && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-saas-border bg-gray-50 px-4 py-2.5">
          <Reply className="w-4 h-4 text-saas-primary-blue shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-saas-primary-blue">
              Replying to {replyingTo.direction === 'OUTBOUND' ? (replyingTo.sender?.name || 'You') : 'Customer'}
            </p>
            <p className="text-xs text-gray-600 truncate">
              {replyingTo.text || replyingTo.caption || `📎 ${replyingTo.messageType.toLowerCase()}`}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors shrink-0"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-start gap-3">
            {filePreview ? (
              <img 
                src={filePreview} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded-lg"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                {getFileIcon(selectedFile)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        {/* Attach Button */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="bg-gray-100 text-gray-700 p-4 rounded-2xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(v => !v)}
            disabled={disabled}
            className="bg-gray-100 text-gray-700 p-4 rounded-2xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
            aria-label="Insert emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showEmojiPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)} />
              <div className="absolute z-20 bottom-full left-0 mb-2 w-72 max-h-72 overflow-y-auto bg-white border border-saas-border rounded-2xl shadow-soft p-3">
                {EMOJI_PICKER_GROUPS.map(group => (
                  <div key={group.label} className="mb-2 last:mb-0">
                    <p className="text-xs font-semibold text-gray-400 mb-1">{group.label}</p>
                    <div className="grid grid-cols-8 gap-1">
                      {group.emojis.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          className="text-xl hover:bg-gray-100 rounded-lg p-1 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowQuickReplyPicker(v => !v)}
            disabled={disabled}
            className="bg-gray-100 text-gray-700 p-4 rounded-2xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
            aria-label="Quick reply"
          >
            <MessageSquareText className="w-5 h-5" />
          </button>

          {showQuickReplyPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowQuickReplyPicker(false)} />
              <div className="absolute z-20 bottom-full left-0 mb-2 w-72 max-h-72 overflow-y-auto bg-white border border-saas-border rounded-2xl shadow-soft py-2">
                {quickReplies.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">Belum ada quick reply aktif</p>
                ) : (
                  quickReplies.map(quickReply => (
                    <button
                      key={quickReply.id}
                      type="button"
                      onClick={() => handleSelectQuickReply(quickReply)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-800">{quickReply.title}</p>
                      <p className="text-xs text-gray-500 truncate">{quickReply.text}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyPress={handleKeyPress}
          placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
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
          disabled={(!message.trim() && !selectedFile) || disabled}
          className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white p-4 rounded-2xl hover:shadow-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 disabled:hover:scale-100 shadow-soft-sm"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
