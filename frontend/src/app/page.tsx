'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import MainNavigation from '@/components/layout/MainNavigation';
import ConversationSidebar from '@/components/sidebar/ConversationSidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import LoginPage from '@/components/auth/LoginPage';
import SettingsPanel from '@/components/settings/SettingsPanel';
import DashboardPanel from '@/components/dashboard/DashboardPanel';
import { conversationApi, messageApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { authApi } from '@/lib/auth';
import type { Conversation, Message, Agent } from '@/types';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentId, setAgentId] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversations' | 'dashboard' | 'broadcast' | 'settings'>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState<{ agentName: string } | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await authApi.me();
        setIsAuthenticated(true);
        setAgent(response.agent);
        setAgentId(response.agent.id);
        setAgentName(response.agent.name);
      } catch (error) {
        console.error('Auth check failed:', error);
        authApi.logout();
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // Sync activeConversation with updated conversations data (for labels update)
  useEffect(() => {
    if (activeConversation) {
      const updatedConversation = conversations.find(c => c.id === activeConversation.id);
      if (updatedConversation) {
        setActiveConversation(updatedConversation);
      }
    }
  }, [conversations]);

  // Refresh agent data after profile update
  const refreshAgentData = async () => {
    try {
      const response = await authApi.me();
      setAgent(response.agent);
      setAgentId(response.agent.id);
      setAgentName(response.agent.name);
    } catch (error) {
      console.error('Failed to refresh agent data:', error);
    }
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await conversationApi.getConversations({
        limit: 100, // Load more to include both open and resolved
      });
      setConversations(response.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const response = await messageApi.getMessages(conversationId, { limit: 100 });
      setMessages(response.messages);
      
      // Mark as read
      await conversationApi.markAsRead(conversationId);
      
      // Update conversation in list
      setConversations(prevConversations =>
        prevConversations.map(conv =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Select conversation
  const handleSelectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    await loadMessages(conversation.id);
    
    // Join socket room for this conversation
    socketClient.joinConversation(conversation.id);
  };

  // Send messsage
  const handleSendMessage = async (text: string) => {
    if (!activeConversation) return;

    try {
      await messageApi.sendMessage({
        conversationId: activeConversation.id,
        text,
        senderId: agentId,
      });

      // Don't add message to state here - let WebSocket handle it
      // This prevents duplicate messages
      // The message will be added when backend emits 'message_received' event
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  // Typing handlers
  const handleTypingStart = () => {
    if (activeConversation) {
      socketClient.sendTypingStart(activeConversation.id, agentName);
    }
  };

  const handleTypingStop = () => {
    if (activeConversation) {
      socketClient.sendTypingStop(activeConversation.id);
    }
  };

  // Resolve conversation
  const handleResolveConversation = async () => {
    if (!activeConversation) return;

    try {
      await conversationApi.resolveConversation(activeConversation.id);
      
      // Update conversation status to 'resolved' instead of removing it
      setConversations(prev => 
        prev.map(conv => 
          conv.id === activeConversation.id 
            ? { ...conv, status: 'resolved' as const }
            : conv
        )
      );
      
      // Clear active conversation and messages
      setActiveConversation(null);
      setMessages([]);
    } catch (error) {
      console.error('Failed to resolve conversation:', error);
      alert('Failed to resolve conversation');
    }
  };

  // Handle login success
  const handleLoginSuccess = (agentId: string, agentName: string) => {
    setIsAuthenticated(true);
    setAgentId(agentId);
    setAgentName(agentName);
    
    // Load full agent data from localStorage or API
    const agentData = authApi.getAgent();
    if (agentData) {
      setAgent(agentData);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await authApi.logout();
    setIsAuthenticated(false);
    setAgent(null);
    setAgentId('');
    setAgentName('');
    setConversations([]);
    setActiveConversation(null);
    setMessages([]);
    socketClient.disconnect();
  };

  // Set up WebSocket listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // Connect socket
    socketClient.connect();

    // Listen for new messages
    socketClient.onMessageReceived(async (data) => {
      const message = data.message;
      // Add message to list if it's for active conversation
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => {
          // Check if message already exists (prevent duplicates)
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }

      // Check if conversation exists in list
      setConversations(prevConversations => {
        const conversationExists = prevConversations.some(conv => conv.id === data.conversationId);
        
        if (conversationExists) {
          // Update existing conversation
          return prevConversations.map(conv => {
            if (conv.id === data.conversationId) {
              return {
                ...conv,
                lastMessageText: message.text,
                lastMessageAt: message.timestamp,
                unreadCount: data.conversationId === activeConversation?.id ? 0 : conv.unreadCount + 1,
              };
            }
            return conv;
          });
        } else {
          // Conversation not in list, reload all conversations
          loadConversations();
          return prevConversations;
        }
      });
    });

    // Listen for typing start
    socketClient.onTypingStart((data) => {
      if (data.conversationId === activeConversation?.id) {
        setTypingIndicator({ agentName: data.agentName });
      }
    });

    // Listen for typing stop
    socketClient.onTypingStop((data) => {
      if (data.conversationId === activeConversation?.id) {
        setTypingIndicator(null);
      }
    });

    return () => {
      socketClient.disconnect();
    };
  }, [isAuthenticated, activeConversation?.id]);

  // Show loading while checking auth
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

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-saas-bg">
      {/* Left Navigation */}
      <MainNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        agentName={agentName}
        agentRole={agent?.role}
      />

      {/* Main Content Area */}
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

      {activeTab === 'dashboard' && (
        <DashboardPanel />
      )}

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
              <p className="text-lg text-gray-600 mb-2">
                Broadcast feature will allow you to send messages to multiple contacts at once.
              </p>
              <p className="text-gray-500">
                Stay tuned for this exciting feature!
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel 
          agentName={agentName} 
          agent={agent || undefined}
          onProfileUpdate={refreshAgentData}
        />
      )}
    </div>
  );
}
