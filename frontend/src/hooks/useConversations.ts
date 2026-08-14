'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { conversationApi, messageApi, complaintApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import type { Conversation, ConversationLabelCounts, ConversationStatusCounts, Message } from '@/types';

const EMPTY_STATUS_COUNTS: ConversationStatusCounts = { served: 0, unread: 0, all: 0 };
const EMPTY_LABEL_COUNTS: ConversationLabelCounts = { unlabeled: 0, byLabel: {} };

const CONVERSATIONS_PAGE_SIZE = 30;
const SEARCH_RESULT_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

export type ConversationFilter = 'served' | 'unread' | 'all';
export type ConversationViewMode = 'normal' | 'label';

interface FetchScope {
  status?: string;
  unreadOnly?: boolean;
  labelId?: string;
}

function scopeKey(scope: FetchScope): string {
  return `${scope.status ?? ''}|${scope.unreadOnly ? 1 : 0}|${scope.labelId ?? ''}`;
}

interface UseConversationsParams {
  isAuthenticated: boolean;
  agentId: string;
  agentName: string;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  statusCounts: ConversationStatusCounts;
  labelCounts: ConversationLabelCounts;
  statusFilter: ConversationFilter;
  setStatusFilter: (filter: ConversationFilter) => void;
  viewMode: ConversationViewMode;
  setViewMode: (mode: ConversationViewMode) => void;
  activeLabelTab: string;
  setActiveLabelTab: (labelTab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Conversation[] | null;
  searching: boolean;
  searchError: string | null;
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
  const [labelCounts, setLabelCounts] = useState<ConversationLabelCounts>(EMPTY_LABEL_COUNTS);
  const [statusFilter, setStatusFilter] = useState<ConversationFilter>('served');
  const [viewMode, setViewMode] = useState<ConversationViewMode>('normal');
  const [activeLabelTab, setActiveLabelTab] = useState<string>('all');

  // "Per Label" always scopes to served (OPEN) conversations; picking a specific label
  // (or "Tanpa Label") narrows it further via labelId, so the fetched rows — not just
  // the badge count — match what that tab actually shows.
  const effectiveScope: FetchScope = viewMode === 'label'
    ? { status: 'OPEN', labelId: activeLabelTab === 'all' ? undefined : activeLabelTab === 'unlabeled' ? 'UNLABELED' : activeLabelTab }
    : statusFilter === 'served'
      ? { status: 'OPEN' }
      : statusFilter === 'unread'
        ? { status: 'OPEN', unreadOnly: true }
        : {};
  const effectiveScopeKey = scopeKey(effectiveScope);
  // Always-current scope for callbacks (loadConversations, search) to read without a
  // stale closure; `activeScopeRef` instead tracks the scope of the page that's
  // actually loaded, for loadMoreConversations to keep paginating consistently.
  const desiredScopeRef = useRef(effectiveScope);
  desiredScopeRef.current = effectiveScope;
  const activeScopeRef = useRef<FetchScope>(effectiveScope);
  const loadRequestIdRef = useRef(0);
  const [searchQueryState, setSearchQueryState] = useState('');
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);
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

  // Scoped server-side to the active tab/label (instead of fetching everything and
  // filtering client-side), so "load more" on any tab only ever pulls rows that tab
  // actually shows. Guarded by a request id so a slow response from a tab the user has
  // since switched away from can't clobber the newer one that already landed.
  const loadConversations = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const scope = desiredScopeRef.current;
    try {
      setLoadingConversations(true);
      const response = await conversationApi.getConversations({
        page: 1,
        limit: CONVERSATIONS_PAGE_SIZE,
        status: scope.status,
        unreadOnly: scope.unreadOnly,
        labelId: scope.labelId,
        includeCounts: true
      });
      if (loadRequestIdRef.current !== requestId) return;
      activeScopeRef.current = scope;
      setConversations(response.conversations);
      setStatusCounts(response.statusCounts ?? EMPTY_STATUS_COUNTS);
      setLabelCounts(response.labelCounts ?? EMPTY_LABEL_COUNTS);
      pageRef.current = 1;
      setHasMoreConversations(response.page < response.totalPages);
    } finally {
      if (loadRequestIdRef.current === requestId) setLoadingConversations(false);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (isFetchingMoreRef.current || !hasMoreConversations) return;
    isFetchingMoreRef.current = true;
    setLoadingMoreConversations(true);
    // Snapshot the load generation so a page-2+ response that resolves after the user
    // has already switched tabs (which bumps loadRequestIdRef via loadConversations)
    // gets discarded instead of splicing the wrong tab's rows into the new list.
    const requestId = loadRequestIdRef.current;
    try {
      const nextPage = pageRef.current + 1;
      const scope = activeScopeRef.current;
      const response = await conversationApi.getConversations({
        page: nextPage,
        limit: CONVERSATIONS_PAGE_SIZE,
        status: scope.status,
        unreadOnly: scope.unreadOnly,
        labelId: scope.labelId
      });
      if (loadRequestIdRef.current !== requestId) return;
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

  // Refetch page 1 whenever the active tab, view mode, or label sub-tab changes.
  useEffect(() => {
    if (isAuthenticated) loadConversations();
    // effectiveScopeKey is the actual dependency; effectiveScope itself is a fresh
    // object every render and would defeat this comparison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, effectiveScopeKey, loadConversations]);

  // Search must query the server across ALL conversations, not just whatever page
  // has been paginated into `conversations` client-side — otherwise a match outside
  // the first page silently looks like "no results" until the user scrolls further.
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      searchRequestIdRef.current += 1;
      setSearchResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError(null);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Deliberately its own independent query, not scoped to the active tab/label —
        // searching for a contact should find their conversation regardless of whether
        // it's currently Served, Unread, or whatever tab happens to be selected.
        const response = await conversationApi.getConversations({ search: trimmed, page: 1, limit: SEARCH_RESULT_LIMIT });
        if (searchRequestIdRef.current !== requestId) return;
        setSearchResults(response.conversations);
      } catch (err: unknown) {
        if (searchRequestIdRef.current !== requestId) return;
        console.error('Conversation search failed:', err);
        setSearchResults(null);
        setSearchError('Failed to search conversations. Please try again.');
      } finally {
        if (searchRequestIdRef.current === requestId) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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
    // A conversation selected from search results may not be in the paginated
    // `conversations` list (search spans more rows than a page holds) — without this,
    // socket updates for it would never find a match and fall back to a full refetch
    // on every inbound message instead of updating in place.
    setConversations(prev => (prev.some(c => c.id === conversation.id) ? prev : [conversation, ...prev]));
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
    conversations, statusCounts, labelCounts,
    statusFilter, setStatusFilter, viewMode, setViewMode, activeLabelTab, setActiveLabelTab,
    searchQuery: searchQueryState, setSearchQuery, searchResults, searching, searchError,
    activeConversation, messages, loadingConversations, loadingMoreConversations,
    hasMoreConversations, loadingMessages, hasMoreMessages, loadingMoreMessages, loadMoreMessages,
    typingIndicator, handleSelectConversation,
    handleSendMessage, handleResolveConversation, handleSendCsat, handleTypingStart, handleTypingStop,
    setConversations, loadConversations, loadMoreConversations,
  };
}
