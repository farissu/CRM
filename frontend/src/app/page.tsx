'use client';

import React, { useState } from 'react';
import { Megaphone } from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import ConversationSidebar from '@/components/sidebar/ConversationSidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import LoginPage from '@/components/auth/LoginPage';
import SettingsPanel from '@/components/settings/SettingsPanel';
import DashboardPanel from '@/components/dashboard/DashboardPanel';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'conversations' | 'dashboard' | 'broadcast' | 'settings'>('conversations');

  const { isAuthenticated, agent, agentId, agentName, checkingAuth, handleLoginSuccess, handleLogout, refreshAgentData } = useAuth();

  const {
    conversations, activeConversation, messages, loadingConversations, loadingMessages,
    typingIndicator, handleSelectConversation, handleSendMessage, handleResolveConversation,
    handleTypingStart, handleTypingStop, loadConversations,
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
            agentName={agentName}
            onLogout={handleLogout}
          />
          <ChatPanel
            conversation={activeConversation}
            messages={messages}
            loading={loadingMessages}
            onSendMessage={handleSendMessage}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onResolveConversation={handleResolveConversation}
            onConversationUpdate={loadConversations}
            typingIndicator={typingIndicator}
          />
        </>
      )}

      {activeTab === 'dashboard' && <DashboardPanel />}

      {activeTab === 'broadcast' && (
        <div className="flex-1 flex flex-col bg-saas-bg">
          <div className="bg-gradient-to-r from-saas-primary-blue to-saas-secondary-blue text-white px-6 py-5 shadow-soft">
            <h1 className="text-3xl font-bold leading-none">Broadcast Messages</h1>
            <p className="text-sm text-white/80 font-medium mt-1">Send messages to multiple contacts</p>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-saas-primary-blue to-saas-secondary-blue flex items-center justify-center mx-auto mb-6 shadow-soft">
                <Megaphone className="w-16 h-16 text-white" strokeWidth={2} />
              </div>
              <h2 className="text-3xl font-bold text-saas-text-primary mb-4">Coming Soon!</h2>
              <p className="text-lg text-gray-600 mb-2">Broadcast feature will allow you to send messages to multiple contacts at once.</p>
              <p className="text-gray-500">Stay tuned for this exciting feature!</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel agentName={agentName} agent={agent || undefined} onProfileUpdate={refreshAgentData} />
      )}
    </div>
  );
}
