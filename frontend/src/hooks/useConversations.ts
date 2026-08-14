'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { conversationApi, messageApi, complaintApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import type { Conversation, ConversationStatusCounts, Message } from '@/types';

const EMPTY_STATUS_COUNTS: ConversationStatusCounts = { served: 0, unread: 0, resolved: 0, all: 0 };

const CONVERSATIONS_PAGE_SIZE = 30;

interface UseConversationsParams {
  isAuthenticated: boolean;
  agentId: string;
  agentName: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  statusCounts: ConversationStatusCounts;
  activeConversation: Conversation | null;
  messages: Message[];
  loadingConversations: boolean;
  loadingMoreConversations: boolean;
  hasMoreConversations: boolean;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  loadingMoreMessages: boolean;
  loadMoreMessages: () => Promise<void>;
  typingIndicator: { agentName: string } | null;
  handleSelectConversation: (conversation: Conversation) => Promise<void>;
  handleSendMessage: (text: string, file?: File, quotedMessageId?: string) => Promise<void>;
  handleResolveConversation: () => Promise<void>;
  handleSendCsat: () => Promise<void>;
  handleTypingStart: () => void;
  handleTypingStop: () => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  loadConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
}

export function useConversations({ isAuthenticated, agentId, agentName }: UseConversationsParams): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [statusCounts, setStatusCounts] = useState<ConversationStatusCounts>(EMPTY_STATUS_COUNTS);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState<{ agentName: string } | null>(null);

  const pageRef = useRef(1);
  const isFetchingMoreRef = useRef(false);
  const messagesPageRef = useRef(1);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const response = await conversationApi.getConversations({ page: 1, limit: CONVERSATIONS_PAGE_SIZE });
      setConversations(response.conversations);
      setStatusCounts(response.statusCounts);
      pageRef.current = 1;
      setHasMoreConversations(response.page < response.totalPages);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (isFetchingMoreRef.current || !hasMoreConversations) return;
    isFetchingMoreRef.current = true;
    setLoadingMoreConversations(true);
    try {
      const nextPage = pageRef.current + 1;
      const response = await conversationApi.getConversations({ page: nextPage, limit: CONVERSATIONS_PAGE_SIZE });
      setConversations(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = response.conversations.filter(c => !existingIds.has(c.id));
        return [...prev, ...newOnes];
      });
      pageRef.current = nextPage;
      setHasMoreConversations(nextPage < response.totalPages);
    } finally {
      setLoadingMoreConversations(false);
      isFetchingMoreRef.current = false;
    }
  }, [hasMoreConversations]);

  useEffect(() => {
    if (isAuthenticated) loadConversations();
  }, [isAuthenticated, loadConversations]);

  // Keep activeConversation in sync when conversation list updates (e.g. label changes)
  useEffect(() => {
    if (!activeConversation) return;
    const updated = conversations.find(c => c.id === activeConversation.id);
    if (updated) setActiveConversation(updated);
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      messagesPageRef.current = 1;
      const response = await messageApi.getMessages(conversationId, { page: 1, limit: 100 });
      setMessages(response.messages);
      setHasMoreMessages(response.page < response.totalPages);
      await conversationApi.markAsRead(conversationId);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!activeConversation || loadingMoreMessages || !hasMoreMessages) return;
    setLoadingMoreMessages(true);
    try {
      const nextPage = messagesPageRef.current + 1;
      const response = await messageApi.getMessages(activeConversation.id, { page: nextPage, limit: 100 });
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const older = response.messages.filter(m => !existingIds.has(m.id));
        return [...older, ...prev];
      });
      messagesPageRef.current = nextPage;
      setHasMoreMessages(nextPage < response.totalPages);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    await loadMessages(conversation.id);
    socketClient.joinConversation(conversation.id);
  };

  const handleSendMessage = async (text: string, file?: File, quotedMessageId?: string) => {
    if (!activeConversation) return;
    try {
      if (file) {
        const uploaded = await messageApi.uploadMedia(file);
        await messageApi.sendMessage({
          conversationId: activeConversation.id,
          senderId: agentId,
          messageType: uploaded.messageType,
          mediaUrl: uploaded.mediaUrl,
          mediaType: uploaded.mediaType,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          caption: text || undefined,
          quotedMessageId,
        });
      } else {
        await messageApi.sendMessage({ conversationId: activeConversation.id, text, senderId: agentId, quotedMessageId });
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      const msg = detail?.message || detail?.error || (err instanceof Error ? err.message : 'Unknown error');
      alert(`Gagal kirim pesan:\n${msg}`);
    }
  };

  const handleResolveConversation = async () => {
    if (!activeConversation) return;
    try {
      await conversationApi.resolveConversation(activeConversation.id);
      setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, status: 'RESOLVED' as const } : c));
      setActiveConversation(null);
      setMessages([]);
    } catch {
      alert('Failed to resolve conversation');
    }
  };

  const handleSendCsat = async () => {
    if (!activeConversation) return;
    try {
      await complaintApi.createForConversation(activeConversation.id);
    } catch {
      alert('Gagal mengirim link penilaian');
    }
  };

  const handleTypingStart = () => { if (activeConversation) socketClient.sendTypingStart(activeConversation.id, agentName); };
  const handleTypingStop = () => { if (activeConversation) socketClient.sendTypingStop(activeConversation.id); };

  useEffect(() => {
    if (!isAuthenticated) return;
    socketClient.connect();

    socketClient.onMessageReceived((data) => {
      const { message } = data;
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
      }
      setConversations(prev => {
        if (!prev.some(c => c.id === data.conversationId)) {
          loadConversations();
          return prev;
        }
        const isActive = data.conversationId === activeConversation?.id;
        const shouldCountUnread = !isActive && message.direction === 'INBOUND';
        return prev.map(c => c.id === data.conversationId ? {
          ...c,
          lastMessageText: message.text ?? c.lastMessageText,
          lastMessageAt: message.timestamp as string,
          unreadCount: isActive ? 0 : (shouldCountUnread ? c.unreadCount + 1 : c.unreadCount),
        } as Conversation : c);
      });
    });

    socketClient.onTypingStart((data) => {
      if (data.conversationId === activeConversation?.id) setTypingIndicator({ agentName: data.agentName });
    });

    socketClient.onTypingStop((data) => {
      if (data.conversationId === activeConversation?.id) setTypingIndicator(null);
    });

    // Payload shape varies by call site (assignment/resolve/read vs. label updates), so
    // treat it purely as a "something changed" signal and refetch rather than merge it.
    socketClient.onConversationUpdated(() => {
      loadConversations();
    });

    socketClient.onMessageStatusUpdated((data) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, status: data.status } : m));
    });

    socketClient.onMessageReactionUpdated((data) => {
      setMessages(prev => prev.map(m => m.id === data.message.id ? data.message : m));
    });

    return () => { socketClient.disconnect(); };
  }, [isAuthenticated, activeConversation?.id, loadConversations]);

  return {
    conversations, statusCounts, activeConversation, messages, loadingConversations, loadingMoreConversations,
    hasMoreConversations, loadingMessages, hasMoreMessages, loadingMoreMessages, loadMoreMessages,
    typingIndicator, handleSelectConversation,
    handleSendMessage, handleResolveConversation, handleSendCsat, handleTypingStart, handleTypingStop,
    setConversations, loadConversations, loadMoreConversations,
  };
}
