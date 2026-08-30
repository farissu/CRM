import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation, ConversationLabelCounts, ConversationStatusCounts, Label } from '@/types';
import type { ConversationFilter, ConversationViewMode } from '@/hooks/useConversations';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { labelApi } from '@/lib/api';

interface ConversationSidebarProps {
  conversations: Conversation[];
  statusCounts: ConversationStatusCounts;
  labelCounts: ConversationLabelCounts;
  statusFilter: ConversationFilter;
  onStatusFilterChange: (filter: ConversationFilter) => void;
  viewMode: ConversationViewMode;
  onViewModeChange: (mode: ConversationViewMode) => void;
  activeLabelTab: string;
  onActiveLabelTabChange: (labelTab: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: Conversation[] | null;
  searching: boolean;
  searchError: string | null;
  activeConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  agentName?: string;
  onLogout?: () => void;
}

export default function ConversationSidebar({
  conversations,
  statusCounts,
  labelCounts,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  activeLabelTab,
  onActiveLabelTabChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  searchError,
  activeConversationId,
  onSelectConversation,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  agentName,
  onLogout,
}: ConversationSidebarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Load labels
  useEffect(() => {
    const loadLabels = async () => {
      try {
        const response = await labelApi.getLabels();
        setLabels(response.labels);
      } catch (error) {
        console.error('Failed to load labels:', error);
      }
    };
    loadLabels();
  }, []);

  // Clear search when closing search box
  useEffect(() => {
    if (!showSearch) {
      onSearchQueryChange('');
    }
    // Only reacts to the box being closed, not to identity changes of the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch]);

  // Infinite scroll: observe a sentinel at the bottom of the list instead of
  // listening to scroll events, so no work happens until the sentinel is near view.
  const listContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    const root = listContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  // Switching tabs/view/labels re-scopes the list to a different set of rows; jump
  // back to the top so the user doesn't land mid-list (or at the bottom of a shorter
  // tab) and think the list "can't scroll" or wasn't reloaded.
  useEffect(() => {
    if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
  }, [statusFilter, viewMode, activeLabelTab, searchQuery]);

  const isSearchActive = !!searchQuery.trim();

  // While searching, the candidate pool is the server-side search result set (spans
  // ALL conversations, not just the currently-loaded page). Each match is reconciled
  // against the live `conversations` state when present, so an already-loaded search
  // hit keeps reflecting real-time socket updates (new messages, resolves, etc.)
  // instead of showing the static snapshot from when the search ran.
  const basePool = isSearchActive
    ? (() => {
        const liveById = new Map(conversations.map(c => [c.id, c]));
        return (searchResults ?? []).map(match => liveById.get(match.id) ?? match);
      })()
    : conversations;

  // `conversations` is already fetched server-side scoped to the active tab; this is
  // just a safety net so an optimistic local mutation (e.g. resolving a conversation
  // while on the Served tab) disappears from view immediately instead of lingering
  // until the next refetch reconciles it.
  const filteredConversations = basePool.filter(conv => {
    if (statusFilter === 'served' && conv.status !== 'OPEN') return false;
    if (statusFilter === 'unread' && (conv.unreadCount === 0 || conv.status !== 'OPEN')) return false;
    if (statusFilter === 'awaiting_reply' && (conv.lastMessageDirection !== 'INBOUND' || conv.status !== 'OPEN')) return false;

    if (selectedLabelId) {
      const hasLabel = conv.contact.labels?.some(label => label.id === selectedLabelId);
      if (!hasLabel) return false;
    }

    return true;
  });

  // Per-label view: only served (OPEN) conversations, grouped by label
  const servedForLabelView = basePool.filter(c => c.status === 'OPEN');
  const conversationsByLabel = labels.map(label => ({
    label,
    conversations: servedForLabelView.filter(c => c.contact.labels?.some(l => l.id === label.id)),
  }));
  const labelGroupsWithConversations = conversationsByLabel.filter(group => group.conversations.length > 0);
  const unlabeledConversations = servedForLabelView.filter(
    c => !c.contact.labels || c.contact.labels.length === 0
  );
  const activeLabelConversations = activeLabelTab === 'all'
    ? servedForLabelView
    : activeLabelTab === 'unlabeled'
      ? unlabeledConversations
      : conversationsByLabel.find(group => group.label.id === activeLabelTab)?.conversations ?? [];

  // Search results aren't paginated (server returns up to SEARCH_RESULT_LIMIT matches
  // in one shot), so the "load more" sentinel — which drives the *unfiltered* list's
  // cursor — is meaningless while a search is active.
  const loadMoreFooter = isSearchActive ? null : (
    <>
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="py-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-saas-primary-blue border-t-transparent"></div>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full md:w-96 bg-white border-r border-saas-border flex flex-col h-full shadow-soft-sm">
      {/* Header */}
      <div className="bg-saas-secondary-blue text-white px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold leading-none">WAKU</h2>
          <div className="flex items-center gap-2">
            {/* Label Filter Button */}
            <div className="relative">
              <button
                onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                className={clsx(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 flex-shrink-0 relative",
                  showLabelDropdown ? "bg-white/20" : "hover:bg-white/10"
                )}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {selectedLabelId && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-saas-primary-blue"></span>
                )}
              </button>

              {/* Label Dropdown */}
              {showLabelDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLabelDropdown(false)}
                  />
                  {/* Dropdown Content */}
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-soft-lg border border-saas-border z-50 overflow-hidden">
                    <div className="p-3 border-b border-saas-border bg-saas-bg">
                      <h3 className="text-sm font-bold text-saas-text-primary">Filter by Label</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {/* All Labels Option */}
                      <button
                        onClick={() => {
                          setSelectedLabelId(null);
                          setShowLabelDropdown(false);
                        }}
                        className={clsx(
                          "w-full px-4 py-3 text-left transition-colors duration-200 flex items-center gap-3",
                          !selectedLabelId
                            ? "bg-saas-primary-blue/10 text-saas-primary-blue font-semibold"
                            : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <div className="w-4 h-4 rounded border-2 border-gray-400 flex items-center justify-center">
                          {!selectedLabelId && (
                            <svg className="w-3 h-3 text-saas-primary-blue" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">All Labels</span>
                      </button>

                      {/* Individual Labels */}
                      {labels.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          No labels yet.<br />Create labels in Settings.
                        </div>
                      ) : (
                        labels.map((label) => (
                          <button
                            key={label.id}
                            onClick={() => {
                              setSelectedLabelId(label.id);
                              setShowLabelDropdown(false);
                            }}
                            className={clsx(
                              "w-full px-4 py-3 text-left transition-colors duration-200 flex items-center gap-3",
                              selectedLabelId === label.id
                                ? "bg-saas-primary-blue/10 text-saas-primary-blue font-semibold"
                                : "hover:bg-gray-50 text-gray-700"
                            )}
                          >
                            <div className="w-4 h-4 rounded border-2 border-gray-400 flex items-center justify-center">
                              {selectedLabelId === label.id && (
                                <svg className="w-3 h-3 text-saas-primary-blue" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div
                              className="w-4 h-4 rounded shadow-soft-sm"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="text-sm flex-1">{label.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Search Button (desktop: click to expand search field) */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={clsx(
                "hidden md:flex w-10 h-10 rounded-2xl items-center justify-center transition-all duration-200 hover:scale-105 flex-shrink-0",
                showSearch ? "bg-white/20" : "hover:bg-white/10"
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Input (mobile: always visible, WhatsApp-style) */}
        <div className="md:hidden mt-4 relative">
          <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Cari nama atau nomor..."
            className="w-full pl-10 pr-10 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white placeholder:text-white/60 border border-white/30 focus:outline-none focus:border-white/50 transition-all duration-200 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Input (desktop: toggled by the search button above) */}
        {showSearch && (
          <div className="hidden md:block mt-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search by name or phone number..."
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder:text-white/60 border border-white/30 focus:outline-none focus:border-white/50 transition-all duration-200 font-medium"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* View Mode Switch */}
      <div className="bg-white border-b border-saas-border px-3 pt-3 pb-2 flex items-center gap-1.5">
        <button
          onClick={() => onViewModeChange('normal')}
          className={clsx(
            'flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200',
            viewMode === 'normal'
              ? 'bg-saas-primary-blue text-white shadow-soft-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          Tampilan Normal
        </button>
        <button
          onClick={() => onViewModeChange('label')}
          className={clsx(
            'flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200',
            viewMode === 'label'
              ? 'bg-saas-primary-blue text-white shadow-soft-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          Per Label
        </button>
      </div>

      {/* Filter Tabs */}
      {viewMode === 'normal' ? (
        <div className="bg-white border-b border-saas-border flex px-2 pt-2">
          <FilterTab
            label="Served"
            count={statusCounts.served}
            active={statusFilter === 'served'}
            onClick={() => onStatusFilterChange('served')}
            color="blue"
          />
          <FilterTab
            label="Belum Dibaca"
            count={statusCounts.unread}
            active={statusFilter === 'unread'}
            onClick={() => onStatusFilterChange('unread')}
            color="red"
          />
          <FilterTab
            label="Belum Dibalas"
            count={statusCounts.awaitingReply}
            active={statusFilter === 'awaiting_reply'}
            onClick={() => onStatusFilterChange('awaiting_reply')}
            color="red"
          />
          <FilterTab
            label="All"
            count={statusCounts.all}
            active={statusFilter === 'all'}
            onClick={() => onStatusFilterChange('all')}
          />
        </div>
      ) : (
        <div className="bg-white border-b border-saas-border px-2 pt-2 pb-2 flex gap-1.5 overflow-x-auto">
          <LabelTab
            name="All"
            count={statusCounts.served}
            active={activeLabelTab === 'all'}
            onClick={() => onActiveLabelTabChange('all')}
          />
          {labels.map((label) => (
            <LabelTab
              key={label.id}
              name={label.name}
              color={label.color}
              count={labelCounts.byLabel[label.id] ?? 0}
              active={activeLabelTab === label.id}
              onClick={() => onActiveLabelTabChange(label.id)}
            />
          ))}
          {labelCounts.unlabeled > 0 && (
            <LabelTab
              name="Tanpa Label"
              count={labelCounts.unlabeled}
              active={activeLabelTab === 'unlabeled'}
              onClick={() => onActiveLabelTabChange('unlabeled')}
            />
          )}
        </div>
      )}

      {/* Conversation List */}
      <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-saas-bg">
        {loading && !isSearchActive && filteredConversations.length === 0 ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-saas-primary-blue border-t-transparent"></div>
          </div>
        ) : isSearchActive && searching ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-saas-primary-blue border-t-transparent"></div>
          </div>
        ) : isSearchActive && searchError ? (
          <div className="p-8 text-center text-red-600 text-sm font-medium">{searchError}</div>
        ) : viewMode === 'normal' ? (
          filteredConversations.length === 0 ? (
            <EmptyListState statusFilter={statusFilter} searching={isSearchActive} />
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeConversationId}
                  onClick={() => onSelectConversation(conversation)}
                />
              ))}
              {loadMoreFooter}
            </>
          )
        ) : activeLabelTab === 'all' ? (
          servedForLabelView.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {isSearchActive ? 'No results found' : 'Tidak ada percakapan served'}
            </div>
          ) : (
            <>
              {labelGroupsWithConversations.map(({ label, conversations: labelConversations }) => (
                <LabelGroupSection
                  key={label.id}
                  name={label.name}
                  color={label.color}
                  conversations={labelConversations}
                  activeConversationId={activeConversationId}
                  onSelectConversation={onSelectConversation}
                />
              ))}
              {unlabeledConversations.length > 0 && (
                <LabelGroupSection
                  name="Tanpa Label"
                  color="#9ca3af"
                  conversations={unlabeledConversations}
                  activeConversationId={activeConversationId}
                  onSelectConversation={onSelectConversation}
                />
              )}
              {loadMoreFooter}
            </>
          )
        ) : activeLabelConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isSearchActive ? 'No results found' : 'Tidak ada percakapan pada label ini'}
          </div>
        ) : (
          <>
            {activeLabelConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() => onSelectConversation(conversation)}
              />
            ))}
            {loadMoreFooter}
          </>
        )}
      </div>
    </div>
  );
}

interface EmptyListStateProps {
  statusFilter: ConversationFilter;
  searching: boolean;
}

function EmptyListState({ statusFilter, searching }: EmptyListStateProps) {
  if (searching) {
    return (
      <div className="p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-gray-700 font-semibold mb-1">No results found</p>
        <p className="text-sm text-gray-500">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-gray-500">
      {statusFilter === 'all' && 'No conversations yet'}
      {statusFilter === 'served' && 'No served conversations'}
      {statusFilter === 'unread' && 'Semua pesan sudah dibaca'}
      {statusFilter === 'awaiting_reply' && 'Semua percakapan sudah dibalas'}
    </div>
  );
}

interface LabelGroupSectionProps {
  name: string;
  color: string;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
}

function LabelGroupSection({ name, color, conversations, activeConversationId, onSelectConversation }: LabelGroupSectionProps) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{name}</span>
        <span className="text-xs text-gray-400">({conversations.length})</span>
      </div>
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
          onClick={() => onSelectConversation(conversation)}
        />
      ))}
    </div>
  );
}

interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: 'red' | 'blue' | 'gray';
}

function FilterTab({ label, count, active, onClick, color }: FilterTabProps) {
  const badgeText = count.toString();

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 py-2 px-1 md:py-3 md:px-3 text-xs md:text-sm font-semibold transition-all duration-200 text-center rounded-t-xl',
        active
          ? 'text-saas-primary-blue bg-white border-b-2 border-saas-primary-blue shadow-soft-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      )}
    >
      <div className="flex flex-col items-center gap-1 md:gap-1.5">
        <span>{label}</span>
        {count > 0 && (
          <span className={clsx(
            'px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 tabular-nums',
            active && color === 'red' && 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-soft-sm',
            active && color === 'blue' && 'bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white shadow-soft-sm',
            active && color === 'gray' && 'bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-soft-sm',
            !active && 'bg-gray-100 text-gray-600'
          )}>
            {badgeText}
          </span>
        )}
      </div>
    </button>
  );
}

interface LabelTabProps {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}

function LabelTab({ name, count, active, onClick, color }: LabelTabProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5',
        active
          ? 'bg-saas-primary-blue/10 text-saas-primary-blue border border-saas-primary-blue'
          : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
      )}
    >
      {color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      <span>{name}</span>
      <span className={clsx('text-xs', active ? 'text-saas-primary-blue' : 'text-gray-400')}>
        {count}
      </span>
    </button>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const displayName = conversation.contact.name || conversation.contact.phoneNumber;
  const lastMessageTime = formatDistanceToNow(new Date(conversation.lastMessageAt), {
    addSuffix: true,
  });

  return (
    <div
      onClick={onClick}
      className={clsx(
        'px-4 py-3 md:m-2 md:p-4 cursor-pointer transition-all duration-200 border-b border-saas-border/60 md:border-b-0 md:rounded-2xl',
        isActive
          ? 'bg-saas-primary-blue/10 md:bg-gradient-to-br md:from-saas-primary-blue/10 md:to-saas-accent-blue/10 md:border-2 md:border-saas-primary-blue md:shadow-soft-sm md:scale-[1.02]'
          : 'bg-white hover:bg-gray-50 md:hover:shadow-soft-sm md:border md:border-transparent md:hover:border-saas-border'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full md:rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center flex-shrink-0 shadow-soft-sm">
          <span className="text-white font-bold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {conversation.unreadCount > 0 && (
                <span className="w-2.5 h-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex-shrink-0 animate-pulse"></span>
              )}
              <h3 className="font-bold text-saas-text-primary truncate text-sm">{displayName}</h3>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap font-medium">
                {lastMessageTime.replace('about ', '').replace(' ago', '')}
              </span>
              {conversation.unreadCount > 0 && (
                <span className="hidden md:inline-flex bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[28px] text-center shadow-soft-sm tabular-nums">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-600 truncate flex-1">
              {conversation.lastMessageText || 'No messages yet'}
            </p>
            {conversation.unreadCount > 0 && (
              <span className="md:hidden flex-shrink-0 bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] h-5 text-center shadow-soft-sm tabular-nums">
                {conversation.unreadCount}
              </span>
            )}
          </div>

          {/* Labels */}
          {conversation.contact.labels && conversation.contact.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {conversation.contact.labels.map((label) => (
                <span
                  key={label.id}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white shadow-soft-sm"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
