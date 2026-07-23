'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { conversationApi, messageApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import type { Conversation, Message } from '@/types';

const CONVERSATIONS_PAGE_SIZE = 30;

interface UseConversationsParams {
  isAuthenticated: boolean;
  agentId: string;
  agentName: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  loadingConversations: boolean;
  loadingMoreConversations: boolean;
  hasMoreConversations: boolean;
  loadingMessages: boolean;
  typingIndicator: { agentName: string } | null;
  handleSelectConversation: (conversation: Conversation) => Promise<void>;
  handleSendMessage: (text: string) => Promise<void>;
  handleResolveConversation: () => Promise<void>;
  handleTypingStart: () => void;
  handleTypingStop: () => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  loadConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
}

export function useConversations({ isAuthenticated, agentId, agentName }: UseConversationsParams): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState<{ agentName: string } | null>(null);

  const pageRef = useRef(1);
  const isFetchingMoreRef = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const response = await conversationApi.getConversations({ page: 1, limit: CONVERSATIONS_PAGE_SIZE });
      setConversations(response.conversations);
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
      const response = await messageApi.getMessages(conversationId, { limit: 100 });
      setMessages(response.messages);
      await conversationApi.markAsRead(conversationId);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    await loadMessages(conversation.id);
    socketClient.joinConversation(conversation.id);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversation) return;
    try {
      await messageApi.sendMessage({ conversationId: activeConversation.id, text, senderId: agentId });
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
        return prev.map(c => c.id === data.conversationId ? {
          ...c,
          lastMessageText: message.text ?? c.lastMessageText,
          lastMessageAt: message.timestamp as string,
          unreadCount: data.conversationId === activeConversation?.id ? 0 : c.unreadCount + 1,
        } as Conversation : c);
      });
    });

    socketClient.onTypingStart((data) => {
      if (data.conversationId === activeConversation?.id) setTypingIndicator({ agentName: data.agentName });
    });

    socketClient.onTypingStop((data) => {
      if (data.conversationId === activeConversation?.id) setTypingIndicator(null);
    });

    return () => { socketClient.disconnect(); };
  }, [isAuthenticated, activeConversation?.id, loadConversations]);

  return {
    conversations, activeConversation, messages, loadingConversations, loadingMoreConversations,
    hasMoreConversations, loadingMessages, typingIndicator, handleSelectConversation,
    handleSendMessage, handleResolveConversation, handleTypingStart, handleTypingStop,
    setConversations, loadConversations, loadMoreConversations,
  };
}
