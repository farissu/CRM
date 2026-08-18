'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import MainNavigation from '@/components/layout/MainNavigation';
import ConversationSidebar from '@/components/sidebar/ConversationSidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import LoginPage from '@/components/auth/LoginPage';
import ForceChangePasswordPage from '@/components/auth/ForceChangePasswordPage';
import SettingsPanel from '@/components/settings/SettingsPanel';
import DashboardPanel from '@/components/dashboard/DashboardPanel';
import BroadcastPanel from '@/components/broadcast/BroadcastPanel';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';

type ActiveTab = 'conversations' | 'dashboard' | 'broadcast' | 'settings';

const ACTIVE_TAB_STORAGE_KEY = 'activeTab';
const VALID_TABS: ActiveTab[] = ['conversations', 'dashboard', 'broadcast', 'settings'];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('conversations');
  // On mobile the sidebar and chat panel occupy the full screen one at a
  // time (WhatsApp-style); on desktop both are always visible side by side.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    setMobileView('list');
  }, [activeTab]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (stored && VALID_TABS.includes(stored as ActiveTab)) {
      setActiveTab(stored as ActiveTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const { isAuthenticated, agent, agentId, agentName, checkingAuth, handleLoginSuccess, handleLogout, refreshAgentData } = useAuth();

  const {
    conversations, statusCounts, labelCounts,
    statusFilter, setStatusFilter, viewMode, setViewMode, activeLabelTab, setActiveLabelTab,
    searchQuery, setSearchQuery, searchResults, searching, searchError,
    activeConversation, messages, loadingConversations, loadingMoreConversations,
    hasMoreConversations, loadingMessages, hasMoreMessages, loadingMoreMessages, loadMoreMessages,
    typingIndicator, handleSelectConversation,
    handleSendMessage, handleResolveConversation, handleSendCsat, handleTypingStart, handleTypingStop,
    loadConversations, loadMoreConversations,
  } = useConversations({ isAuthenticated, agentId, agentName });

  if (checkingAuth) {
    return (
      <div className="flex h-dvh items-center justify-center bg-saas-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-saas-primary-blue border-t-transparent mx-auto mb-4"></div>
          <p className="text-saas-text-primary font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (agent?.mustChangePassword) {
    return <ForceChangePasswordPage onPasswordChanged={refreshAgentData} />;
  }

  const isMobileChatOpen = activeTab === 'conversations' && mobileView === 'chat';

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-saas-bg">
      <MainNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        agentName={agentName}
        agentRole={agent?.role}
        hideMobileNav={isMobileChatOpen}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {activeTab === 'conversations' && (
          <>
            <div className={clsx('h-full min-w-0', mobileView === 'chat' ? 'hidden md:block' : 'block')}>
              <ConversationSidebar
                conversations={conversations}
                statusCounts={statusCounts}
                labelCounts={labelCounts}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                activeLabelTab={activeLabelTab}
                onActiveLabelTabChange={setActiveLabelTab}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                searchResults={searchResults}
                searching={searching}
                searchError={searchError}
                activeConversationId={activeConversation?.id}
                onSelectConversation={(conversation) => {
                  handleSelectConversation(conversation);
                  setMobileView('chat');
                }}
                loading={loadingConversations}
                hasMore={hasMoreConversations}
                loadingMore={loadingMoreConversations}
                onLoadMore={loadMoreConversations}
                agentName={agentName}
                onLogout={handleLogout}
              />
            </div>
            <div className={clsx('flex-1 min-w-0 h-full', mobileView === 'list' ? 'hidden md:flex' : 'flex')}>
              <ChatPanel
                conversation={activeConversation}
                messages={messages}
                loading={loadingMessages}
                hasMoreMessages={hasMoreMessages}
                loadingMoreMessages={loadingMoreMessages}
                onLoadMoreMessages={loadMoreMessages}
                onSendMessage={handleSendMessage}
                onTypingStart={handleTypingStart}
                onTypingStop={handleTypingStop}
                onResolveConversation={handleResolveConversation}
                onConversationUpdate={loadConversations}
                onSendCsat={handleSendCsat}
                typingIndicator={typingIndicator}
                onBack={() => setMobileView('list')}
              />
            </div>
          </>
        )}

        {activeTab === 'dashboard' && <DashboardPanel />}

        {activeTab === 'broadcast' && <BroadcastPanel />}

        {activeTab === 'settings' && (
          <SettingsPanel agentName={agentName} agent={agent || undefined} onProfileUpdate={refreshAgentData} />
        )}
      </div>
    </div>
  );
}
