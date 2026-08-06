import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation, Label } from '@/types';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { labelApi } from '@/lib/api';

type StatusFilter = 'served' | 'unread' | 'resolved' | 'all';
type ViewMode = 'normal' | 'label';

interface ConversationSidebarProps {
  conversations: Conversation[];
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
  activeConversationId,
  onSelectConversation,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  agentName,
  onLogout,
}: ConversationSidebarProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('served');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [activeLabelTab, setActiveLabelTab] = useState<string>('all');

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
      setSearchQuery('');
    }
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

  // Search filter applies regardless of view mode
  const searchFilteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contactName = (conv.contact.name || '').toLowerCase();
    const phoneNumber = conv.contact.phoneNumber.toLowerCase();
    return contactName.includes(query) || phoneNumber.includes(query);
  });

  // Normal view: filter by status tab + optional label filter
  const filteredConversations = searchFilteredConversations.filter(conv => {
    if (statusFilter === 'served' && conv.status !== 'OPEN') return false;
    if (statusFilter === 'unread' && (conv.unreadCount === 0 || conv.status !== 'OPEN')) return false;
    if (statusFilter === 'resolved' && conv.status !== 'RESOLVED') return false;

    if (selectedLabelId) {
      const hasLabel = conv.contact.labels?.some(label => label.id === selectedLabelId);
      if (!hasLabel) return false;
    }

    return true;
  });

  const servedCount = conversations.filter(c => c.status === 'OPEN').length;
  const unreadCount = conversations.filter(c => c.status === 'OPEN' && c.unreadCount > 0).length;
  const resolvedCount = conversations.filter(c => c.status === 'RESOLVED').length;

  // Per-label view: only served (OPEN) conversations, grouped by label
  const servedForLabelView = searchFilteredConversations.filter(c => c.status === 'OPEN');
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

  const loadMoreFooter = (
    <>
      {hasMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="py-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-saas-primary-blue border-t-transparent"></div>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white border-r border-saas-border flex flex-col h-full shadow-soft-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5">
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

            {/* Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={clsx(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 flex-shrink-0",
                showSearch ? "bg-white/20" : "hover:bg-white/10"
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="mt-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone number..."
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder:text-white/60 border border-white/30 focus:outline-none focus:border-white/50 transition-all duration-200 font-medium"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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
          onClick={() => setViewMode('normal')}
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
          onClick={() => setViewMode('label')}
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
            count={servedCount}
            active={statusFilter === 'served'}
            onClick={() => setStatusFilter('served')}
            color="blue"
          />
          <FilterTab
            label="Belum Dibaca"
            count={unreadCount}
            active={statusFilter === 'unread'}
            onClick={() => setStatusFilter('unread')}
            color="red"
          />
          <FilterTab
            label="Resolved"
            count={resolvedCount}
            active={statusFilter === 'resolved'}
            onClick={() => setStatusFilter('resolved')}
            color="gray"
          />
          <FilterTab
            label="All"
            count={conversations.length}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
        </div>
      ) : (
        <div className="bg-white border-b border-saas-border px-2 pt-2 pb-2 flex gap-1.5 overflow-x-auto">
          <LabelTab
            name="All"
            count={servedForLabelView.length}
            active={activeLabelTab === 'all'}
            onClick={() => setActiveLabelTab('all')}
          />
          {conversationsByLabel.map(({ label, conversations: labelConversations }) => (
            <LabelTab
              key={label.id}
              name={label.name}
              color={label.color}
              count={labelConversations.length}
              active={activeLabelTab === label.id}
              onClick={() => setActiveLabelTab(label.id)}
            />
          ))}
          {unlabeledConversations.length > 0 && (
            <LabelTab
              name="Tanpa Label"
              count={unlabeledConversations.length}
              active={activeLabelTab === 'unlabeled'}
              onClick={() => setActiveLabelTab('unlabeled')}
            />
          )}
        </div>
      )}

      {/* Conversation List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto bg-saas-bg">
        {viewMode === 'normal' ? (
          filteredConversations.length === 0 ? (
            <EmptyListState statusFilter={statusFilter} searching={!!searchQuery.trim()} />
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
              {searchQuery.trim() ? 'No results found' : 'Tidak ada percakapan served'}
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
            {searchQuery.trim() ? 'No results found' : 'Tidak ada percakapan pada label ini'}
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
  statusFilter: StatusFilter;
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
      {statusFilter === 'resolved' && 'No resolved conversations'}
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
        'flex-1 py-3 px-3 text-sm font-semibold transition-all duration-200 text-center rounded-t-xl',
        active
          ? 'text-saas-primary-blue bg-white border-b-2 border-saas-primary-blue shadow-soft-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      )}
    >
      <div className="flex flex-col items-center gap-1.5">
        <span>{label}</span>
        {count > 0 && (
          <span className={clsx(
            'px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200',
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
        'm-2 p-4 rounded-2xl cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-gradient-to-br from-saas-primary-blue/10 to-saas-accent-blue/10 border-2 border-saas-primary-blue shadow-soft-sm scale-[1.02]'
          : 'bg-white hover:bg-gray-50 hover:shadow-soft-sm border border-transparent hover:border-saas-border'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-saas-secondary-blue to-saas-accent-blue flex items-center justify-center flex-shrink-0 shadow-soft-sm">
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
                <span className="bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[28px] text-center shadow-soft-sm">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate flex-1 pr-2">
              {conversation.lastMessageText || 'No messages yet'}
            </p>
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
