'use client';

import React, { useState, useEffect } from 'react';
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
    conversations, activeConversation, messages, loadingConversations, loadingMoreConversations,
    hasMoreConversations, loadingMessages, hasMoreMessages, loadingMoreMessages, loadMoreMessages,
    typingIndicator, handleSelectConversation,
    handleSendMessage, handleResolveConversation, handleSendCsat, handleTypingStart, handleTypingStop,
    loadConversations, loadMoreConversations,
  } = useConversations({ isAuthenticated, agentId, agentName });

  if (checkingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-saas-bg">
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

  return (
    <div className="flex h-screen bg-saas-bg">
      <MainNavigation activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} agentName={agentName} agentRole={agent?.role} />

      {activeTab === 'conversations' && (
        <>
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            onSelectConversation={handleSelectConversation}
            loading={loadingConversations}
            hasMore={hasMoreConversations}
            loadingMore={loadingMoreConversations}
            onLoadMore={loadMoreConversations}
            agentName={agentName}
            onLogout={handleLogout}
          />
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
          />
        </>
      )}

      {activeTab === 'dashboard' && <DashboardPanel />}

      {activeTab === 'broadcast' && <BroadcastPanel />}

      {activeTab === 'settings' && (
        <SettingsPanel agentName={agentName} agent={agent || undefined} onProfileUpdate={refreshAgentData} />
      )}
    </div>
  );
}
